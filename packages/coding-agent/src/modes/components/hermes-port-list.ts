/**
 * Hermes port overlays — Kanban / Cron / Profiles.
 *
 * Design: Herm fork table + detail split (Cron.tsx / Kanban list density),
 * painted with OMP overlay chrome (topBorder/splitRow/theme). Not a flat
 * SelectList dump — real columns, selection caret, side KV pane when wide.
 */
import type { Component, TUI } from "@oh-my-pi/pi-tui"
import { matchesKey, routeSgrMouseInput, type SgrMouseEvent, visibleWidth } from "@oh-my-pi/pi-tui"
import {
	cronPort,
	kanbanPort,
	profilePort,
	formatCronRunLine,
	type CronJob,
	type CronSchedulerStatus,
	type CronRunRow,
	type KanbanDetail,
	type KanbanTask,
	type ProfileInfo,
} from "@omherm/hermes-bridge"
import { theme } from "../theme/theme"
import {
	bottomBorder,
	divider,
	dividerSplit,
	fit,
	row,
	splitBodyWidth,
	splitRow,
	topBorder,
	topBorderSplit,
} from "./overlay-box"
import {
	matchesSelectCancel,
	matchesSelectDown,
	matchesSelectPageDown,
	matchesSelectPageUp,
	matchesSelectUp,
} from "../utils/keybinding-matchers"
import {
	enableOverlayScopedPaint,
	paintOverlayFull,
	paintOverlayLocal,
	paintOverlayReload,
} from "../utils/overlay-paint"

export type HermesPortKind = "kanban" | "cron" | "profiles"

/** Pad plain text to width (no ANSI). Fast path for ASCII labels. */
function pad(s: string, w: number): string {
	if (w <= 0) return ""
	const t = s ?? ""
	// Fast path: printable ASCII only — inventory/port labels are almost always this.
	let ascii = true
	for (let i = 0; i < t.length; i++) {
		const c = t.charCodeAt(i)
		if (c < 0x20 || c > 0x7e) {
			ascii = false
			break
		}
	}
	if (ascii) {
		if (t.length === w) return t
		if (t.length < w) return t + " ".repeat(w - t.length)
		if (w === 1) return "…"
		return t.slice(0, w - 1) + "…"
	}
	const vw = visibleWidth(t)
	if (vw === w) return t
	if (vw < w) return t + " ".repeat(w - vw)
	// truncate
	let out = ""
	let used = 0
	for (const ch of t) {
		const cw = visibleWidth(ch)
		if (used + cw > w - 1) break
		out += ch
		used += cw
	}
	return out + "…".slice(0, Math.max(0, w - used))
}

function agoLabel(iso?: string): string {
	if (!iso) return "—"
	const t = Date.parse(iso)
	if (Number.isNaN(t)) return iso.slice(0, 16)
	const sec = Math.max(0, Math.floor((Date.now() - t) / 1000))
	if (sec < 60) return `${sec}s ago`
	if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
	if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
	return `${Math.floor(sec / 86400)}d ago`
}

function untilLabel(iso?: string): string {
	if (!iso) return "—"
	const t = Date.parse(iso)
	if (Number.isNaN(t)) return iso.slice(0, 16)
	const sec = Math.floor((t - Date.now()) / 1000)
	if (sec <= 0) return "due"
	if (sec < 60) return `in ${sec}s`
	if (sec < 3600) return `in ${Math.floor(sec / 60)}m`
	if (sec < 86400) return `in ${Math.floor(sec / 3600)}h`
	return `in ${Math.floor(sec / 86400)}d`
}

const STATUS_ORDER = [
	"triage",
	"todo",
	"scheduled",
	"ready",
	"running",
	"blocked",
	"review",
	"done",
	"archived",
] as const

type ConfirmKind = "remove_cron" | "use_profile" | "delete_profile" | null

type FormField = { key: string; label: string; value: string; help?: string }
type FormKind =
	| "cron_create"
	| "cron_edit"
	| "kanban_create"
	| "kanban_assign"
	| "kanban_comment"
	| "kanban_board"

type FormState = {
	kind: FormKind
	fields: FormField[]
	idx: number
	/** typing into selected field */
	editing: boolean
	/** job/task id for edit/assign */
	targetId?: string
	error?: string
}

export class HermesPortListComponent implements Component {
	#tui: TUI
	#kind: HermesPortKind
	#onCancel: () => void

	#loading = true
	#error = ""
	#banner = ""
	/** true when banner is a failure (CLI death / throw) — paint warning, not accent success. */
	#bannerIsError = false
	#sel = 0
	#scroll = 0
	/** list | detail_focus (actions on detail) | confirm | form */
	#focus: "table" | "actions" | "confirm" | "form" = "table"
	#actionSel = 0
	#confirm: ConfirmKind = null
	#form: FormState | null = null

	#jobs: CronJob[] = []
	#cronStatus: CronSchedulerStatus | null = null
	#tasks: KanbanTask[] = []
	#boardSlug = "default"
	#boards: { slug: string; name: string; current: boolean; counts?: string }[] = []
	#detail: KanbanDetail | CronJob | null = null
	#detailLines: string[] = []
	#profiles: ProfileInfo[] = []
	#runsPreview: CronRunRow[] = []
	/** target profile name for confirm dialogs */
	#confirmTarget = ""

	/** Cached layout from last render */
	#tableRows = 12
	#wide = false
	/** Mouse hit geometry (overlay MUST be top-left anchored so screen row == line). */
	#tableStartRow = 0
	#tableHitCount = 0
	/** Exclusive right edge of table hit zone (cols left of detail pane). */
	#tableColEnd = 9999
	#actionStartRow = -1
	#actionCount = 0
	/** Relative row of first action inside detail body (before frame offset). */
	#actionRelStart = -1
	#confirmRows: { cancel: number; yes: number } | null = null
	#formFieldStarts: number[] = []
	/** Debounce detail network refresh after wheel/selection storms. */
	#detailRefreshTimer: ReturnType<typeof setTimeout> | undefined
	#detailRefreshGen = 0
	/** Last selected index whose detail was fetched (skip redundant CLI). */
	#detailForSel = -1
	/** Hovered table row index (absolute task/job index), or -1. */
	#hoverIdx = -1
	#lastHoverKey = ""
	/** Coalesced hover target (B2.5) — applied on 16ms timer. */
	#pendingHoverIdx = -1
	#hoverPaintTimer: ReturnType<typeof setTimeout> | null = null

	constructor(tui: TUI, kind: HermesPortKind, onCancel: () => void) {
		this.#tui = tui
		this.#kind = kind
		this.#onCancel = onCancel
		// Hover/sel/nav only mutates this overlay — prefer component-scoped paint.
		enableOverlayScopedPaint(this.#tui, this)
		void this.reload()
	}

	/** Local overlay paint (hover/nav). Prefer component-scoped when available. */
	#paintLocal(): void {
		paintOverlayLocal(this.#tui, this)
	}

	/** Structural paint (cold open only). Soft reload uses local. */
	#paintFull(): void {
		paintOverlayFull(this.#tui)
	}

	/** Set status banner. Errors paint warning/error fg so CLI death is not accent-green. */
	#setBanner(text: string, isError = false): void {
		this.#banner = text
		this.#bannerIsError = isError && !!text
	}

	#bannerFg(text: string): string {
		if (this.#bannerIsError) {
			return theme.fg("warning", text)
		}
		return theme.fg("accent", text)
	}

	async reload(): Promise<void> {
		const cold = this.#count() === 0
		this.#loading = cold
		this.#error = ""
		this.#setBanner("")
		// Skip full-frame flash on soft reload (R after data already shown).
		if (cold) this.#paintFull()
		try {
			if (this.#kind === "cron") {
				const [jobs, st] = await Promise.all([
					cronPort.list({ all: true }),
					cronPort.status().catch(() => null),
				])
				this.#jobs = jobs
				this.#cronStatus = st
				if (this.#sel >= jobs.length) this.#sel = Math.max(0, jobs.length - 1)
				this.#paintDetailFromList()
				void this.#refreshCronDetail()
			} else if (this.#kind === "kanban") {
				const [tasks, boards, cur] = await Promise.all([
					kanbanPort.list({ limit: 80, board: this.#boardSlug !== "default" ? this.#boardSlug : undefined }),
					kanbanPort.listBoards().catch(() => [] as Awaited<ReturnType<typeof kanbanPort.listBoards>>),
					kanbanPort.currentBoard().catch(() => this.#boardSlug),
				])
				this.#tasks = tasks
				this.#boards = boards
				if (cur) this.#boardSlug = cur
				// Prefer ● current from boards list when available
				const marked = boards.find((b) => b.current)
				if (marked) this.#boardSlug = marked.slug
				if (this.#sel >= this.#tasks.length) this.#sel = Math.max(0, this.#tasks.length - 1)
				this.#paintDetailFromList()
			} else {
				this.#profiles = await profilePort.list()
				if (this.#sel >= this.#profiles.length) this.#sel = Math.max(0, this.#profiles.length - 1)
				this.#detail = null
				this.#detailLines = []
			}
		} catch (e) {
			this.#error = e instanceof Error ? e.message : String(e)
		} finally {
			this.#loading = false
			// Warm + completion: local only (B2.5). Cold already painted once above.
			paintOverlayReload(this.#tui, this, false)
		}
	}

	/**
	 * Instant detail from already-loaded list rows. Never spawnSync here —
	 * `hermes kanban/cron show` blocks the TUI event loop for seconds and
	 * made every click feel dead.
	 */
	#paintDetailFromList(): void {
		if (this.#kind === "cron") {
			const j = this.#jobs[this.#sel]
			if (!j) {
				this.#detail = null
				this.#detailLines = []
				this.#runsPreview = []
				this.#detailForSel = -1
				return
			}
			this.#detail = j
			this.#detailLines = this.#cronKv(j)
			this.#detailForSel = this.#sel
			return
		}
		if (this.#kind === "kanban") {
			const t = this.#tasks[this.#sel]
			if (!t) {
				this.#detail = null
				this.#detailLines = []
				this.#detailForSel = -1
				return
			}
			this.#detail = t
			this.#detailLines = this.#kanbanKv(t)
			this.#detailForSel = this.#sel
			return
		}
		this.#detail = null
		this.#detailLines = []
		this.#detailForSel = this.#sel
	}

	async #refreshCronDetail(): Promise<void> {
		// List paint already ran. Soft-enrich runs only (best-effort, non-blocking).
		const j = this.#jobs[this.#sel]
		if (!j) return
		const sel = this.#sel
		cronPort
			.runs(j.id, 12)
			.then((rows) => {
				if (sel !== this.#sel) return
				this.#runsPreview = rows
				this.#paintLocal()
			})
			.catch((e) => {
				if (sel !== this.#sel) return
				this.#runsPreview = []
				// Fail-loud: don't hide runs CLI death
				this.#setBanner(e instanceof Error ? e.message : String(e), true)
				this.#paintLocal()
			})
	}

	async #refreshKanbanDetail(): Promise<void> {
		// Intentionally no-op for selection path. List DTO is enough for the
		// pane; spawnSync `kanban show` freezes mouse for 3–5s. Mutations still
		// go through CLI on action keys (archive/complete/…).
		this.#paintDetailFromList()
	}

	#cronKv(j: CronJob): string[] {
		const lastBits = [
			j.last_run ? agoLabel(j.last_run) : "",
			j.last_status ?? "",
			j.last_error ? `err: ${j.last_error.slice(0, 80)}` : "",
		]
			.filter(Boolean)
			.join(" · ")
		const rows: [string, string][] = [
			["ID", j.id],
			["State", j.enabled ? "active" : "paused"],
			["Schedule", j.schedule || "—"],
			["Deliver", j.deliver || "local"],
			["Last", lastBits || "never"],
			["Next", j.enabled ? untilLabel(j.next_run) : "paused"],
			["Repeat", j.repeat != null ? String(j.repeat) : ""],
			["Provider", j.provider || ""],
			["Model", j.model || ""],
			["No agent", j.no_agent ? "true" : ""],
			["Skills", j.skills?.join(", ") || ""],
			["Script", j.script || ""],
			["Workdir", j.workdir || ""],
			["Error", j.last_error || ""],
			["Prompt", (j.prompt || "").replace(/\s+/g, " ").slice(0, 240)],
		]
		return rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)
	}

	#kanbanKv(d: KanbanDetail | KanbanTask): string[] {
		const body = "body" in d && d.body ? String(d.body).replace(/\s+/g, " ").slice(0, 300) : ""
		const rows: [string, string][] = [
			["ID", d.id],
			["Status", d.status],
			["Title", d.title],
			["Assignee", d.assignee || "unassigned"],
			["Priority", d.priority != null ? String(d.priority) : ""],
			["Body", body],
		]
		if ("showText" in d && d.showText) {
			const extra = d.showText
				.split("\n")
				.map((l) => l.trim())
				.filter((l) => l && !l.startsWith("{") && !l.startsWith("}"))
				.slice(0, 12)
			return [...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`), ...extra.map((l) => l.slice(0, 100))]
		}
		return rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)
	}

	#count(): number {
		if (this.#kind === "cron") return this.#jobs.length
		if (this.#kind === "kanban") return this.#tasks.length
		return this.#profiles.length
	}

	#title(): string {
		if (this.#kind === "cron") return `Cron (${this.#jobs.length})`
		if (this.#kind === "kanban") return `Kanban · ${this.#boardSlug} (${this.#tasks.length})`
		return `Profiles (${this.#profiles.length})`
	}

	#clampScroll(): void {
		const n = this.#count()
		const vis = this.#tableRows
		if (this.#sel < this.#scroll) this.#scroll = this.#sel
		if (this.#sel >= this.#scroll + vis) this.#scroll = this.#sel - vis + 1
		this.#scroll = Math.max(0, Math.min(this.#scroll, Math.max(0, n - vis)))
	}

	#actions(): { id: string; label: string; desc: string }[] {
		if (this.#kind === "cron") {
			const j = this.#jobs[this.#sel]
			const back = { id: "close", label: "Back to Settings", desc: "Esc/q" }
			const base = [
				{ id: "create", label: "New job…", desc: "n" },
				{ id: "reload", label: "Reload list", desc: "R" },
				back,
			]
			if (!j) return base
			return [
				{ id: "create", label: "New job…", desc: "n" },
				{ id: "edit", label: "Edit job…", desc: "e" },
				{ id: "toggle", label: j.enabled ? "Pause" : "Resume", desc: "p" },
				{ id: "run", label: "Run next tick", desc: "!" },
				{ id: "runs", label: "Refresh runs", desc: "" },
				{ id: "reload", label: "Reload list", desc: "R" },
				{ id: "remove", label: "Delete job…", desc: "d" },
				back,
			]
		}
		if (this.#kind === "kanban") {
			const t = this.#tasks[this.#sel]
			const back = { id: "close", label: "Back to Settings", desc: "Esc/q" }
			const base = [
				{ id: "create", label: "New task…", desc: "n" },
				{ id: "switch_board", label: `Board: ${this.#boardSlug}…`, desc: "B" },
				{ id: "reload", label: "Reload list", desc: "R" },
				back,
			]
			if (!t) return base
			return [
				{ id: "create", label: "New task…", desc: "n" },
				{ id: "switch_board", label: `Board: ${this.#boardSlug}…`, desc: "B" },
				{ id: "comment", label: "Comment…", desc: "m" },
				{ id: "assign", label: "Assign…", desc: "a" },
				{ id: "promote", label: "Promote → ready", desc: "u" },
				{ id: "complete", label: "Complete", desc: "c" },
				{ id: "block", label: "Block", desc: "b" },
				{ id: "unblock", label: "Unblock", desc: "" },
				{ id: "archive", label: "Archive", desc: "r" },
				{ id: "reload", label: "Reload list", desc: "R" },
				back,
			]
		}
		const p = this.#profiles[this.#sel]
		const backP = { id: "close", label: "Back to Settings", desc: "Esc/q" }
		if (!p) {
			return [
				{ id: "reload", label: "Reload", desc: "R" },
				backP,
			]
		}
		return [
			{
				id: "use_profile",
				label: p.is_active ? "Active (sticky)" : `Use ${p.name}…`,
				desc: "Enter",
			},
			{
				id: "delete_profile",
				label: p.name === "default" ? "Delete (blocked)" : "Delete profile…",
				desc: "d",
			},
			{ id: "reload", label: "Reload", desc: "R" },
			backP,
		]
	}

	async #runAction(id: string): Promise<void> {
		this.#setBanner("")
		try {
			if (id === "close" || id === "back") {
				this.#onCancel()
				return
			}
			if (id === "reload") {
				await this.reload()
				return
			}
			if (id === "create") {
				if (this.#kind === "cron") this.#openCronCreate()
				else if (this.#kind === "kanban") this.#openKanbanCreate()
				return
			}
			if (id === "edit" && this.#kind === "cron") {
				this.#openCronEdit()
				return
			}
			if (id === "assign" && this.#kind === "kanban") {
				this.#openKanbanAssign()
				return
			}
			if (id === "comment" && this.#kind === "kanban") {
				this.#openKanbanComment()
				return
			}
			if (id === "switch_board" && this.#kind === "kanban") {
				this.#openKanbanBoardSwitch()
				return
			}
			if (this.#kind === "profiles") {
				const p = this.#profiles[this.#sel]
				if (!p) return
				if (id === "use_profile") {
					if (p.is_active) {
						this.#setBanner(`Already on profile ${p.name}`)
						this.#paintLocal()
						return
					}
					this.#confirm = "use_profile"
					this.#confirmTarget = p.name
					this.#focus = "confirm"
					this.#actionSel = 0
					this.#paintLocal()
					return
				}
				if (id === "delete_profile") {
					if (p.name === "default") {
						this.#setBanner("cannot delete default profile", true)
						this.#paintLocal()
						return
					}
					this.#confirm = "delete_profile"
					this.#confirmTarget = p.name
					this.#focus = "confirm"
					this.#actionSel = 0
					this.#paintLocal()
					return
				}
			}
			if (this.#kind === "cron") {
				const j = this.#jobs[this.#sel]
				if (!j) return
				if (id === "toggle") {
					this.#setBanner(j.enabled ? await cronPort.pause(j.id) : await cronPort.resume(j.id))
					await this.reload()
					return
				}
				if (id === "run") {
					this.#setBanner(await cronPort.run(j.id))
					await this.#refreshCronDetail()
					return
				}
				if (id === "runs") {
					await this.#refreshCronDetail()
					this.#setBanner("Runs refreshed")
					return
				}
				if (id === "remove") {
					this.#confirm = "remove_cron"
					this.#focus = "confirm"
					this.#actionSel = 0
					this.#paintLocal()
					return
				}
			}
			if (this.#kind === "kanban") {
				const t = this.#tasks[this.#sel]
				if (!t) return
				const b = this.#boardSlug
				if (id === "promote") this.#setBanner(await kanbanPort.promote([t.id], b))
				else if (id === "complete") this.#setBanner(await kanbanPort.complete([t.id], b))
				else if (id === "block") this.#setBanner(await kanbanPort.block([t.id], b))
				else if (id === "unblock") this.#setBanner(await kanbanPort.unblock([t.id], b))
				else if (id === "archive") this.#setBanner(await kanbanPort.archive([t.id], b))
				await this.reload()
			}
		} catch (e) {
			this.#setBanner(e instanceof Error ? e.message : String(e), true)
		}
		this.#paintLocal()
	}

	#openCronCreate(): void {
		this.#form = {
			kind: "cron_create",
			idx: 0,
			editing: true,
			fields: [
				{ key: "name", label: "Name", value: "", help: "optional" },
				{ key: "schedule", label: "Schedule", value: "every 1d", help: "cron / every 30m / ISO" },
				{ key: "prompt", label: "Prompt", value: "", help: "required unless script" },
				{ key: "deliver", label: "Deliver", value: "local", help: "local | origin | all" },
			],
		}
		this.#focus = "form"
		this.#paintLocal()
	}

	#openCronEdit(): void {
		const j = this.#jobs[this.#sel]
		if (!j) return
		this.#form = {
			kind: "cron_edit",
			targetId: j.id,
			idx: 0,
			editing: true,
			fields: [
				{ key: "schedule", label: "Schedule", value: j.schedule || "", help: "cron / every 30m / ISO" },
				{ key: "prompt", label: "Prompt", value: j.prompt || "", help: "job prompt" },
				{ key: "name", label: "Name", value: j.name || "", help: "display name" },
				{ key: "deliver", label: "Deliver", value: j.deliver || "local", help: "local | origin | all" },
			],
		}
		this.#focus = "form"
		this.#paintLocal()
	}

	#openKanbanCreate(): void {
		this.#form = {
			kind: "kanban_create",
			idx: 0,
			editing: true,
			fields: [
				{ key: "title", label: "Title", value: "", help: "required" },
				{ key: "body", label: "Body", value: "", help: "optional" },
				{ key: "assignee", label: "Assignee", value: "", help: "optional" },
			],
		}
		this.#focus = "form"
		this.#paintLocal()
	}

	#openKanbanAssign(): void {
		const t = this.#tasks[this.#sel]
		if (!t) return
		this.#form = {
			kind: "kanban_assign",
			targetId: t.id,
			idx: 0,
			editing: true,
			fields: [
				{
					key: "assignee",
					label: "Assignee",
					value: t.assignee || "",
					help: "agent name or empty to unassign",
				},
			],
		}
		this.#focus = "form"
		this.#paintLocal()
	}

	#openKanbanComment(): void {
		const t = this.#tasks[this.#sel]
		if (!t) return
		this.#form = {
			kind: "kanban_comment",
			targetId: t.id,
			idx: 0,
			editing: true,
			fields: [
				{
					key: "text",
					label: "Comment",
					value: "",
					help: "required — append note on task",
				},
			],
		}
		this.#focus = "form"
		this.#paintLocal()
	}

	#openKanbanBoardSwitch(): void {
		const known = this.#boards.map((b) => `${b.current ? "●" : " "} ${b.slug}`).join("  ")
		this.#form = {
			kind: "kanban_board",
			idx: 0,
			editing: true,
			fields: [
				{
					key: "slug",
					label: "Board slug",
					value: this.#boardSlug,
					help: known
						? `known: ${known} · hermes kanban boards switch`
						: "hermes kanban boards switch <slug>",
				},
			],
		}
		this.#focus = "form"
		this.#paintLocal()
	}

	async #submitForm(): Promise<void> {
		const f = this.#form
		if (!f) return
		const get = (k: string) => f.fields.find((x) => x.key === k)?.value.trim() || ""
		try {
			if (f.kind === "cron_create") {
				const schedule = get("schedule")
				const prompt = get("prompt")
				if (!schedule) {
					f.error = "schedule required"
					this.#paintLocal()
					return
				}
				if (!prompt) {
					f.error = "prompt required"
					this.#paintLocal()
					return
				}
				this.#setBanner(
					await cronPort.create({
						schedule,
						prompt,
						name: get("name") || undefined,
						deliver: get("deliver") || undefined,
					}),
				)
			} else if (f.kind === "cron_edit" && f.targetId) {
				const schedule = get("schedule")
				if (!schedule) {
					f.error = "schedule required"
					this.#paintLocal()
					return
				}
				this.#setBanner(
					await cronPort.edit(f.targetId, {
						schedule,
						prompt: get("prompt") || undefined,
						name: get("name") || undefined,
						deliver: get("deliver") || undefined,
					}),
				)
			} else if (f.kind === "kanban_create") {
				const title = get("title")
				if (!title) {
					f.error = "title required"
					this.#paintLocal()
					return
				}
				this.#setBanner(
					await kanbanPort.create({
						title,
						body: get("body") || undefined,
						assignee: get("assignee") || undefined,
						board: this.#boardSlug,
					}),
				)
			} else if (f.kind === "kanban_assign" && f.targetId) {
				const who = get("assignee") || "unassigned"
				this.#setBanner(await kanbanPort.assign(f.targetId, who, this.#boardSlug))
			} else if (f.kind === "kanban_comment" && f.targetId) {
				const text = get("text")
				if (!text) {
					f.error = "comment required"
					this.#paintLocal()
					return
				}
				this.#setBanner(await kanbanPort.comment(f.targetId, text, this.#boardSlug))
			} else if (f.kind === "kanban_board") {
				const slug = get("slug")
				if (!slug) {
					f.error = "board slug required"
					this.#paintLocal()
					return
				}
				this.#setBanner(await kanbanPort.switchBoard(slug))
				this.#boardSlug = slug
			}
			this.#form = null
			this.#focus = "table"
			await this.reload()
		} catch (e) {
			f.error = e instanceof Error ? e.message : String(e)
			this.#paintLocal()
		}
	}

	handleInput(data: string): void {
		if (data.startsWith("\x1b[<")) {
			this.#handleMouse(data)
			return
		}
		if (matchesSelectCancel(data) || data === "q") {
			if (this.#focus === "form") {
				this.#form = null
				this.#focus = "table"
				this.#paintLocal()
				return
			}
			if (this.#focus === "confirm") {
				this.#confirm = null
				this.#focus = "table"
				this.#paintLocal()
				return
			}
			if (this.#focus === "actions") {
				this.#focus = "table"
				this.#paintLocal()
				return
			}
			// Esc/q from table = back to settings (port dismiss), not full app quit
			this.#onCancel()
			return
		}

		// Inline form (create/edit/assign)
		if (this.#focus === "form" && this.#form) {
			const form = this.#form
			const field = form.fields[form.idx]
			if (!field) return

			if (matchesKey(data, "tab") || data === "	") {
				form.idx = (form.idx + 1) % form.fields.length
				form.editing = true
				form.error = undefined
				this.#paintLocal()
				return
			}
			if (matchesSelectUp(data)) {
				form.idx = (form.idx + form.fields.length - 1) % form.fields.length
				form.editing = true
				this.#paintLocal()
				return
			}
			if (matchesSelectDown(data)) {
				form.idx = (form.idx + 1) % form.fields.length
				form.editing = true
				this.#paintLocal()
				return
			}
			// Ctrl+Enter submit (often arrives as \n with control — also bare enter when last field)
			if (matchesKey(data, "enter") || matchesKey(data, "return") || data === "\n" || data === "\r") {
				if (form.idx === form.fields.length - 1) {
					void this.#submitForm()
				} else {
					form.idx = form.idx + 1
					form.editing = true
					this.#paintLocal()
				}
				return
			}
			// backspace
			if (data === "\x7f" || data === "\b") {
				field.value = field.value.slice(0, -1)
				this.#paintLocal()
				return
			}
			// printable
			if (data.length === 1 && data >= " ") {
				field.value += data
				this.#paintLocal()
				return
			}
			// multi-char paste
			if (data.length > 1 && !data.includes("\x1b")) {
				field.value += data.replace(/\r/g, "")
				this.#paintLocal()
			}
			return
		}

		// Confirm dialog
		if (this.#focus === "confirm") {
			if (matchesSelectUp(data) || matchesSelectDown(data)) {
				this.#actionSel = this.#actionSel === 0 ? 1 : 0
				this.#paintLocal()
				return
			}
			if (matchesKey(data, "enter") || matchesKey(data, "return") || data === "\n") {
				void (async () => {
					if (this.#actionSel === 1) {
						try {
							if (this.#confirm === "remove_cron") {
								const j = this.#jobs[this.#sel]
								if (j) this.#setBanner(await cronPort.remove(j.id))
							} else if (this.#confirm === "use_profile" && this.#confirmTarget) {
								await profilePort.use(this.#confirmTarget, { confirmSessionEnd: true })
								this.#setBanner(
									`Switched sticky profile → ${this.#confirmTarget}. Restart mtui / gateway to attach.`,
								)
							} else if (this.#confirm === "delete_profile" && this.#confirmTarget) {
								await profilePort.delete(this.#confirmTarget, { confirmDestroy: true })
								this.#setBanner(`Deleted profile ${this.#confirmTarget}`)
							}
						} catch (e) {
							this.#setBanner(e instanceof Error ? e.message : String(e), true)
						}
					}
					this.#confirm = null
					this.#confirmTarget = ""
					this.#focus = "table"
					await this.reload()
				})()
				return
			}
			return
		}

		// Global hotkeys (Herm parity)
		if (data === "R") {
			void this.reload()
			return
		}
		if (data === "n") {
			if (this.#kind === "cron") this.#openCronCreate()
			else if (this.#kind === "kanban") this.#openKanbanCreate()
			return
		}
		if (data === "e" && this.#kind === "cron") {
			this.#openCronEdit()
			return
		}
		if (data === "a" && this.#kind === "kanban") {
			this.#openKanbanAssign()
			return
		}
		if (data === "m" && this.#kind === "kanban") {
			this.#openKanbanComment()
			return
		}
		if (data === "d" && this.#kind === "profiles") {
			void this.#runAction("delete_profile")
			return
		}
		if (
			(matchesKey(data, "enter") || matchesKey(data, "return") || data === "\n") &&
			this.#kind === "profiles" &&
			this.#focus === "table"
		) {
			void this.#runAction("use_profile")
			return
		}
		if (data === "	") {
			// Tab toggles table ↔ actions when detail exists
			if (this.#count() > 0) {
				this.#focus = this.#focus === "table" ? "actions" : "table"
				this.#actionSel = 0
				this.#paintLocal()
			}
			return
		}

		if (this.#focus === "actions") {
			const acts = this.#actions()
			if (matchesSelectUp(data)) {
				this.#actionSel = (this.#actionSel + acts.length - 1) % acts.length
				this.#paintLocal()
				return
			}
			if (matchesSelectDown(data)) {
				this.#actionSel = (this.#actionSel + 1) % acts.length
				this.#paintLocal()
				return
			}
			if (matchesKey(data, "enter") || matchesKey(data, "return") || data === "\n") {
				void this.#runAction(acts[this.#actionSel]?.id || "close")
				return
			}
			return
		}

		// Table focus — Herm single-key actions
		if (this.#kind === "cron") {
			if (data === "p") {
				void this.#runAction("toggle")
				return
			}
			if (data === "!" || data === "r") {
				// "r" kept as alias for run on cron; kanban owns "r" for archive
				void this.#runAction("run")
				return
			}
			if (data === "d") {
				void this.#runAction("remove")
				return
			}
		}
		if (this.#kind === "kanban") {
			if (data === "u") {
				void this.#runAction("promote")
				return
			}
			if (data === "c") {
				void this.#runAction("complete")
				return
			}
			if (data === "B") {
				void this.#runAction("switch_board")
				return
			}
			if (data === "b") {
				void this.#runAction("block")
				return
			}
			if (data === "r" || data === "d") {
				// r = archive (operator); d kept as alias
				void this.#runAction("archive")
				return
			}
		}

		const n = this.#count()
		if (n === 0) return

		if (matchesSelectUp(data)) {
			this.#sel = (this.#sel + n - 1) % n
			void this.#onSelChange()
			return
		}
		if (matchesSelectDown(data)) {
			this.#sel = (this.#sel + 1) % n
			void this.#onSelChange()
			return
		}
		if (matchesSelectPageUp(data)) {
			this.#sel = Math.max(0, this.#sel - this.#tableRows)
			void this.#onSelChange()
			return
		}
		if (matchesSelectPageDown(data)) {
			this.#sel = Math.min(n - 1, this.#sel + this.#tableRows)
			void this.#onSelChange()
			return
		}
		if (matchesKey(data, "enter") || matchesKey(data, "return") || data === "\n") {
			// Enter opens actions pane (detail already visible when wide)
			this.#focus = "actions"
			this.#actionSel = 0
			this.#paintLocal()
		}
	}

	#handleMouse(data: string): void {
		routeSgrMouseInput(data, (event: SgrMouseEvent) => {
			if (event.release) return true

			// Hover highlight — motion only paints, never selects. Coalesce ~60fps
			// so SGR motion storms don't queue a paint per event (B2.5).
			if (event.motion) {
				if (
					this.#focus === "table" &&
					event.row >= this.#tableStartRow &&
					event.row < this.#tableStartRow + this.#tableHitCount &&
					event.col < this.#tableColEnd
				) {
					const idx = this.#scroll + (event.row - this.#tableStartRow)
					const n = this.#count()
					const next = idx >= 0 && idx < n ? idx : -1
					const key = `${next}|${event.row}`
					if (key !== this.#lastHoverKey) {
						this.#lastHoverKey = key
						this.#pendingHoverIdx = next
						if (this.#hoverPaintTimer == null) {
							this.#hoverPaintTimer = setTimeout(() => {
								this.#hoverPaintTimer = null
								if (this.#pendingHoverIdx !== this.#hoverIdx) {
									this.#hoverIdx = this.#pendingHoverIdx
									this.#paintLocal()
								}
							}, 16)
						}
					}
				} else if (this.#hoverIdx !== -1 || this.#pendingHoverIdx !== -1) {
					this.#hoverIdx = -1
					this.#pendingHoverIdx = -1
					this.#lastHoverKey = ""
					if (this.#hoverPaintTimer != null) {
						clearTimeout(this.#hoverPaintTimer)
						this.#hoverPaintTimer = null
					}
					this.#paintLocal()
				}
				return true
			}

			if (event.wheel !== null) {
				this.#hoverIdx = -1
				if (this.#focus === "confirm") {
					this.#actionSel = this.#actionSel === 0 ? 1 : 0
					this.#paintLocal()
					return true
				}
				if (this.#focus === "form" && this.#form) {
					const form = this.#form
					form.idx = Math.max(0, Math.min(form.fields.length - 1, form.idx + event.wheel))
					form.editing = true
					this.#paintLocal()
					return true
				}
				if (this.#focus === "actions") {
					const acts = this.#actions()
					if (acts.length) {
						this.#actionSel = Math.max(0, Math.min(acts.length - 1, this.#actionSel + event.wheel))
						this.#paintLocal()
					}
					return true
				}
				// Table: move selection + viewport only — NEVER await network on every
				// wheel tick (that locked the TUI when kanban/cron was opened from settings).
				const n = this.#count()
				if (n > 0) {
					const next = Math.max(0, Math.min(n - 1, this.#sel + event.wheel))
					if (next !== this.#sel) {
						this.#sel = next
						this.#focus = "table"
						this.#clampScroll()
						// Instant list detail — never spawnSync on wheel.
						this.#paintDetailFromList()
						this.#paintLocal()
						if (this.#kind === "cron") this.#scheduleDetailRefresh(160)
					} else {
						// At edge: still paint so clamp feels responsive
						this.#paintLocal()
					}
				}
				return true
			}
			if (!event.leftClick) return true

			if (this.#focus === "confirm" && this.#confirmRows) {
				if (event.row === this.#confirmRows.cancel) {
					this.#actionSel = 0
					this.#confirm = null
					this.#focus = "table"
					this.#paintLocal()
					return true
				}
				if (event.row === this.#confirmRows.yes) {
					this.#actionSel = 1
					// Reuse keyboard confirm path
					this.handleInput("\n")
					return true
				}
				return true
			}

			if (this.#focus === "form" && this.#form && this.#formFieldStarts.length) {
				for (let i = 0; i < this.#formFieldStarts.length; i++) {
					const start = this.#formFieldStarts[i]!
					const next = this.#formFieldStarts[i + 1] ?? start + 2
					if (event.row >= start && event.row < next) {
						this.#form.idx = i
						this.#form.editing = true
						this.#paintLocal()
						return true
					}
				}
				return true
			}

			// Actions column (right pane / stacked) — prefer over table when overlapping rows
			if (
				this.#actionStartRow >= 0 &&
				event.row >= this.#actionStartRow &&
				event.row < this.#actionStartRow + this.#actionCount &&
				// On wide layout actions sit in the right pane (col >= tableColEnd)
				(!this.#wide || event.col >= this.#tableColEnd)
			) {
				const i = event.row - this.#actionStartRow
				const acts = this.#actions()
				if (i >= 0 && i < acts.length) {
					if (this.#focus === "actions" && this.#actionSel === i) {
						void this.#runAction(acts[i]!.id)
					} else {
						this.#focus = "actions"
						this.#actionSel = i
						this.#paintLocal()
					}
				}
				return true
			}

			// Table rows: only the LEFT column on wide split (right is detail).
			// Requires top-left overlay anchor so event.row == component line index.
			if (
				event.row >= this.#tableStartRow &&
				event.row < this.#tableStartRow + this.#tableHitCount &&
				event.col < this.#tableColEnd
			) {
				const idx = this.#scroll + (event.row - this.#tableStartRow)
				const n = this.#count()
				if (idx >= 0 && idx < n) {
					// Instant select + list-backed detail (no CLI). Second click
					// on same row enters action focus for Enter-to-run.
					this.#focus = idx === this.#sel && this.#focus === "table" ? "actions" : "table"
					if (this.#focus === "actions") this.#actionSel = 0
					this.#sel = idx
					this.#hoverIdx = idx
					this.#clampScroll()
					this.#paintDetailFromList()
					this.#paintLocal()
					// Cron: soft-load recent runs after settle (still async-ish).
					if (this.#kind === "cron") this.#scheduleDetailRefresh(120)
				}
				return true
			}
			return true
		})
	}

	/** Soft async enrich only (cron runs). Selection paint is always sync. */
	#scheduleDetailRefresh(delayMs = 90): void {
		if (this.#detailRefreshTimer) clearTimeout(this.#detailRefreshTimer)
		const gen = ++this.#detailRefreshGen
		const sel = this.#sel
		this.#detailRefreshTimer = setTimeout(() => {
			this.#detailRefreshTimer = undefined
			if (gen !== this.#detailRefreshGen || sel !== this.#sel) return
			void this.#refreshDetailNow()
		}, delayMs)
		this.#detailRefreshTimer.unref?.()
	}

	async #refreshDetailNow(): Promise<void> {
		const gen = this.#detailRefreshGen
		// Always keep list paint current first.
		this.#paintDetailFromList()
		if (this.#kind === "cron") await this.#refreshCronDetail()
		if (gen !== this.#detailRefreshGen) return
		this.#paintLocal()
	}

	async #onSelChange(): Promise<void> {
		this.#clampScroll()
		// Instant local detail — never await hermes CLI on ↑/↓.
		this.#paintDetailFromList()
		this.#paintLocal()
		if (this.#kind === "cron") this.#scheduleDetailRefresh(120)
	}

	// ── render helpers ──────────────────────────────────────────

	/** selectedBg band for selection; lighter accent band for hover-only. */
	#paintRowBand(line: string, inner: number, selected: boolean, hovered: boolean): string {
		const fitted = fit(line, inner)
		if (selected) return theme.bg("selectedBg", fitted)
		if (hovered) return theme.bg("selectedBg", theme.fg("accent", fitted))
		return fitted
	}

	#renderCronHeader(inner: number): string {
		// ▸ · · Name …… Schedule(14) Last(12) Next(12)
		const schedW = 14
		const lastW = 12
		const nextW = 12
		const fixed = 2 + 2 + schedW + lastW + nextW + 3 // carets + gaps
		const nameW = Math.max(8, inner - fixed)
		const h =
			theme.fg("dim", pad("  ", 2) + pad("  ", 2) + pad("Name", nameW) + " " + pad("Schedule", schedW) + " " + pad("Last", lastW) + " " + pad("Next", nextW))
		return h
	}

	#renderCronRow(j: CronJob, selected: boolean, hovered: boolean, inner: number): string {
		const schedW = 14
		const lastW = 12
		const nextW = 12
		const fixed = 2 + 2 + schedW + lastW + nextW + 3
		const nameW = Math.max(8, inner - fixed)
		const caret = selected ? theme.fg("accent", "▸ ") : "  "
		const glyph = j.enabled ? "●" : "○"
		const gColor =
			!j.enabled ? "dim" : j.last_status === "error" ? "error" : j.last_status === "ok" ? "success" : "dim"
		const name = pad(j.name || j.id, nameW)
		const namePaint = selected ? theme.bold(theme.fg("accent", name)) : theme.fg("text", name)
		const line =
			caret +
			theme.fg(gColor, glyph + " ") +
			namePaint +
			" " +
			theme.fg("dim", pad(j.schedule || "—", schedW)) +
			" " +
			theme.fg("dim", pad(agoLabel(j.last_run), lastW)) +
			" " +
			theme.fg(j.enabled ? "text" : "dim", pad(j.enabled ? untilLabel(j.next_run) : "paused", nextW))
		return this.#paintRowBand(line, inner, selected, hovered && !selected)
	}

	#renderKanbanHeader(inner: number): string {
		const stW = 10
		const idW = 12
		const whoW = 12
		const fixed = 2 + stW + idW + whoW + 3
		const titleW = Math.max(8, inner - fixed)
		return theme.fg(
			"dim",
			pad("  ", 2) + pad("Status", stW) + " " + pad("ID", idW) + " " + pad("Who", whoW) + " " + pad("Title", titleW),
		)
	}

	#renderKanbanRow(t: KanbanTask, selected: boolean, hovered: boolean, inner: number): string {
		const stW = 10
		const idW = 12
		const whoW = 12
		const fixed = 2 + stW + idW + whoW + 3
		const titleW = Math.max(8, inner - fixed)
		const caret = selected ? theme.fg("accent", "▸ ") : "  "
		const stColor =
			t.status === "done"
				? "success"
				: t.status === "blocked"
					? "error"
					: t.status === "ready" || t.status === "running"
						? "accent"
						: "dim"
		const line =
			caret +
			theme.fg(stColor, pad(t.status, stW)) +
			" " +
			theme.fg("dim", pad(t.id, idW)) +
			" " +
			theme.fg("dim", pad(t.assignee || "—", whoW)) +
			" " +
			(selected ? theme.bold(theme.fg("accent", pad(t.title, titleW))) : theme.fg("text", pad(t.title, titleW)))
		return this.#paintRowBand(line, inner, selected, hovered && !selected)
	}

	#renderProfileRow(p: ProfileInfo, selected: boolean, hovered: boolean, inner: number): string {
		const caret = selected ? theme.fg("accent", "▸ ") : "  "
		const mark = p.is_active ? theme.fg("success", "● ") : theme.fg("dim", "○ ")
		const name = pad(p.name + (p.is_sticky ? " *" : ""), Math.min(24, Math.floor(inner * 0.35)))
		const rest = [p.model, p.provider].filter(Boolean).join(" · ")
		const line = caret + mark + (selected ? theme.bold(theme.fg("accent", name)) : name) + " " + theme.fg("dim", rest)
		return this.#paintRowBand(line, inner, selected, hovered && !selected)
	}

	#detailTitle(): string {
		if (this.#kind === "cron") {
			const j = this.#detail as CronJob | null
			return j ? j.name || j.id : "Job Detail"
		}
		if (this.#kind === "kanban") {
			const t = this.#detail as KanbanDetail | KanbanTask | null
			return t ? t.id : "Task Detail"
		}
		return "Profile"
	}

	#renderDetailBody(bodyW: number, maxLines: number): string[] {
		const lines: string[] = []
		const title = this.#detailTitle()
		lines.push(theme.bold(theme.fg("accent", pad(title, bodyW))))
		lines.push("")
		for (const l of this.#detailLines) {
			if (lines.length >= maxLines - 4) break
			// KV: key dim, value text
			const m = l.match(/^([^:]+):\s*(.*)$/)
			if (m) {
				const key = m[1]
				const val = m[2]
				const keyPart = theme.fg("dim", pad(key, Math.min(12, Math.floor(bodyW * 0.35))))
				const valW = Math.max(4, bodyW - visibleWidth(key) - 2)
				lines.push(fit(`${theme.fg("dim", key + ":")} ${theme.fg("text", pad(val, valW))}`, bodyW))
			} else {
				lines.push(fit(theme.fg("text", l), bodyW))
			}
		}
		if (this.#kind === "cron" && this.#runsPreview.length) {
			if (lines.length < maxLines - 2) {
				lines.push("")
				lines.push(theme.fg("dim", `Recent runs (${this.#runsPreview.length})`))
				for (const r of this.#runsPreview) {
					if (lines.length >= maxLines) break
					const line = formatCronRunLine(r, Math.max(24, bodyW - 2))
					const color =
						r.status === "error"
							? "error"
							: r.status === "ok"
								? "success"
								: "dim"
					lines.push(fit(theme.fg(color as "dim", line), bodyW))
				}
			}
		} else if (this.#kind === "cron" && this.#jobs[this.#sel]) {
			if (lines.length < maxLines - 1) {
				lines.push("")
				lines.push(theme.fg("dim", "Recent runs · Tab → Refresh runs"))
			}
		}
		// Keep detail clean — keys live on the FULL-WIDTH footer (not split).
		// Only paint a compact action list when focus === "actions" (Tab).
		const acts = this.#actions()
		this.#actionCount = acts.length
		this.#actionRelStart = -1
		if (this.#focus === "actions" && acts.length > 0) {
			lines.push("")
			lines.push(theme.fg("dim", "Actions · Enter runs · Esc back to list"))
			for (let i = 0; i < acts.length && lines.length < maxLines; i++) {
				const a = acts[i]!
				const sel = i === this.#actionSel
				const mark = sel ? theme.fg("accent", "▸ ") : "  "
				const lab = sel ? theme.bold(theme.fg("accent", a.label)) : theme.fg("text", a.label)
				const desc = a.desc ? theme.fg("dim", `  ${a.desc}`) : ""
				if (i === 0) this.#actionRelStart = lines.length
				lines.push(fit(mark + lab + desc, bodyW))
			}
		}
		while (lines.length < maxLines) lines.push("")
		return lines.slice(0, maxLines)
	}

	/** Single full-width chrome line — never split (split was clipping keys). */
	#hint(): string {
		const back = "Esc/q → Settings"
		if (this.#kind === "cron") {
			return `↑↓ · n new · e edit · !/r run · p pause · d delete · R reload · Tab actions · ${back}`
		}
		if (this.#kind === "kanban") {
			return `↑↓ · n new · B board · m comment · a assign · r archive · c complete · u promote · R reload · Tab · ${back}`
		}
		return `↑↓ · Enter use profile · d delete · R reload · Tab actions · ${back}`
	}

	render(width: number): string[] {
		const w = Math.max(40, width)
		this.#wide = w >= 100 && this.#kind !== "profiles"
		this.#confirmRows = null
		this.#formFieldStarts = []
		this.#actionStartRow = -1
		this.#actionCount = 0
		this.#tableStartRow = 0
		this.#tableHitCount = 0
		this.#tableColEnd = w // default full width; wide layout tightens below

		// Vertical budget from terminal when available (OMP overlay is % of screen).
		const termRows = typeof process !== "undefined" && process.stdout?.rows ? process.stdout.rows : 36
		// Fill almost full height — top-left anchor + tall table so mouse 1:1
		// and less dead chrome under the board.
		const chrome = this.#wide ? 8 : 14
		this.#tableRows = Math.max(8, Math.min(termRows - 4, termRows - chrome))
		this.#clampScroll()

		const out: string[] = []

		if (this.#loading) {
			out.push(topBorder(w, this.#title()))
			out.push(row(theme.fg("dim", "Loading…"), w))
			out.push(bottomBorder(w))
			return out
		}

		if (this.#error) {
			out.push(topBorder(w, this.#title()))
			out.push(row(theme.fg("error", this.#error.slice(0, w - 6)), w))
			out.push(row(theme.fg("dim", "Esc close · R retry"), w))
			out.push(bottomBorder(w))
			return out
		}

		if (this.#focus === "form" && this.#form) {
			const form = this.#form
			const titles: Record<FormKind, string> = {
				cron_create: "New cron job",
				cron_edit: "Edit cron job",
				kanban_create: "New kanban task",
				kanban_assign: "Assign task",
			}
			out.push(topBorder(w, titles[form.kind]))
			out.push(row(theme.fg("dim", "↑↓ fields  type  Enter next/save  Esc cancel · click field"), w))
			if (form.error) out.push(row(theme.fg("error", form.error.slice(0, w - 6)), w))
			out.push(divider(w))
			const inner = Math.max(20, w - 4)
			for (let i = 0; i < form.fields.length; i++) {
				this.#formFieldStarts.push(out.length)
				const f = form.fields[i]!
				const active = i === form.idx
				const caret = active ? theme.fg("accent", "▸ ") : "  "
				const lab = active ? theme.bold(theme.fg("accent", pad(f.label, 12))) : theme.fg("dim", pad(f.label, 12))
				const valShow = (f.value || (active ? "█" : "—")).slice(0, Math.max(8, inner - 16))
				const val = active ? theme.fg("text", valShow) : theme.fg("dim", valShow)
				out.push(row(fit(caret + lab + " " + val, inner), w))
				if (active && f.help) out.push(row(theme.fg("dim", "    " + f.help), w))
			}
			out.push(divider(w))
			out.push(
				row(
					theme.fg(
						"dim",
						form.idx === form.fields.length - 1 ? "Enter · save" : "Enter · next field",
					),
					w,
				),
			)
			out.push(bottomBorder(w))
			return out
		}

		if (this.#focus === "confirm") {
			const title =
				this.#confirm === "use_profile"
					? "Confirm profile switch"
					: this.#confirm === "delete_profile"
						? "Confirm delete profile"
						: "Confirm delete"
			out.push(topBorder(w, title))
			let warn = ""
			if (this.#confirm === "remove_cron") {
				const j = this.#jobs[this.#sel]
				warn = `Delete cron "${j?.name || j?.id || "?"}"? This cannot be undone.`
			} else if (this.#confirm === "use_profile") {
				warn = `Use profile "${this.#confirmTarget}"? Sticky default flips; current session ends. Restart mtui to attach.`
			} else if (this.#confirm === "delete_profile") {
				warn = `Delete profile "${this.#confirmTarget}"? Home dir destroyed. Cannot undo.`
			} else {
				warn = "Confirm?"
			}
			out.push(row(theme.fg("warning", warn), w))
			out.push(row("", w))
			this.#confirmRows = { cancel: out.length, yes: out.length + 1 }
			const yesLabel =
				this.#confirm === "use_profile"
					? "Yes, switch profile"
					: this.#confirm === "delete_profile"
						? "Yes, delete permanently"
						: "Yes, delete permanently"
			out.push(row((this.#actionSel === 0 ? theme.fg("accent", "▸ ") : "  ") + "Cancel", w))
			out.push(
				row((this.#actionSel === 1 ? theme.fg("error", "▸ ") : "  ") + theme.fg("error", yesLabel), w),
			)
			out.push(row(theme.fg("dim", "↑↓  Enter  Esc · click"), w))
			out.push(bottomBorder(w))
			return out
		}

		// Status strip
		let statusLine = ""
		if (this.#kind === "cron" && this.#cronStatus) {
			statusLine = this.#cronStatus.running
				? theme.fg("success", `scheduler up`) +
					theme.fg("dim", `${this.#cronStatus.pid ? ` · pid ${this.#cronStatus.pid}` : ""}${this.#cronStatus.heartbeatAge ? ` · hb ${this.#cronStatus.heartbeatAge}` : ""}`)
				: theme.fg("warning", "scheduler not confirmed · CLI degraded ok")
		} else if (this.#kind === "kanban") {
			const by = new Map<string, number>()
			for (const t of this.#tasks) by.set(t.status, (by.get(t.status) || 0) + 1)
			statusLine = theme.fg(
				"dim",
				STATUS_ORDER.filter((s) => by.has(s))
					.map((s) => `${s}:${by.get(s)}`)
					.join("  ") || "empty board",
			)
		} else {
			statusLine = theme.fg("dim", "active marked ● · sticky *")
		}

		if (this.#wide) {
			// Left table ~55%, right detail rest — Herm showDetail at width>=120; we use 100
			const sideW = Math.min(56, Math.max(36, Math.floor((w - 7) * 0.52)))
			const bodyW = splitBodyWidth(w, sideW)
			const tableInner = sideW
			const rows = this.#tableRows
			// Table hit zone ends at the vertical divider (sideW + border inset).
			this.#tableColEnd = sideW + 3

			out.push(topBorderSplit(w, this.#title(), sideW))
			out.push(splitRow(fit(statusLine, sideW), fit(theme.fg("dim", "Detail"), bodyW), w, sideW))
			if (this.#banner) {
				out.push(splitRow(fit(this.#bannerFg(this.#banner.slice(0, sideW)), sideW), "", w, sideW))
			}
			out.push(dividerSplit(w, sideW))

			// Header row
			const hdr =
				this.#kind === "cron"
					? this.#renderCronHeader(tableInner)
					: this.#kind === "kanban"
						? this.#renderKanbanHeader(tableInner)
						: theme.fg("dim", "  profile")
			out.push(splitRow(fit(hdr, sideW), fit(theme.bold(theme.fg("dim", this.#detailTitle())), bodyW), w, sideW))

			const detailLines = this.#renderDetailBody(bodyW, rows + 1)
			const n = this.#count()
			// Detail body is painted as the right column aligned with table rows
			// starting after header line (current out.length + loop). Table starts next.
			const tableStartBefore = out.length

			if (n === 0) {
				const empty =
					this.#kind === "cron"
						? theme.fg("dim", "No jobs — hermes cron create '30m' '…'")
						: theme.fg("dim", "No tasks")
				for (let i = 0; i < rows; i++) {
					out.push(splitRow(i === 0 ? fit(empty, sideW) : "", fit(detailLines[i] || "", bodyW), w, sideW))
				}
			} else {
				this.#tableStartRow = out.length
				this.#tableHitCount = rows
				for (let i = 0; i < rows; i++) {
					const idx = this.#scroll + i
					let left = ""
					if (idx < n) {
						if (this.#kind === "cron") left = this.#renderCronRow(this.#jobs[idx]!, idx === this.#sel, idx === this.#hoverIdx, tableInner)
						else if (this.#kind === "kanban") left = this.#renderKanbanRow(this.#tasks[idx]!, idx === this.#sel, idx === this.#hoverIdx, tableInner)
						else left = this.#renderProfileRow(this.#profiles[idx]!, idx === this.#sel, idx === this.#hoverIdx, tableInner)
					}
					out.push(splitRow(fit(left, sideW), fit(detailLines[i] || "", bodyW), w, sideW))
				}
			}
			// Map action rows: relative within detailLines, absolute = tableStart + rel
			if (this.#actionRelStart >= 0 && this.#tableStartRow > 0) {
				this.#actionStartRow = this.#tableStartRow + this.#actionRelStart
			} else if (this.#actionRelStart >= 0) {
				this.#actionStartRow = tableStartBefore + this.#actionRelStart
			}

			// Full-width footer under the split (keys were clipped in a split footer).
			out.push(divider(w))
			out.push(row(theme.fg("dim", this.#hint()), w))
			out.push(bottomBorder(w))
			return out
		}

		// Narrow: stacked table then detail snippet
		out.push(topBorder(w, this.#title()))
		out.push(row(statusLine, w))
		if (this.#banner) out.push(row(this.#bannerFg(this.#banner.slice(0, w - 6)), w))
		out.push(divider(w))
		const inner = Math.max(20, w - 4)
		if (this.#kind === "cron") out.push(row(this.#renderCronHeader(inner), w))
		else if (this.#kind === "kanban") out.push(row(this.#renderKanbanHeader(inner), w))
		out.push(divider(w))

		const n = this.#count()
		const rows = this.#tableRows
		if (n === 0) {
			out.push(row(theme.fg("dim", this.#kind === "cron" ? "No cron jobs." : "Empty."), w))
		} else {
			this.#tableStartRow = out.length
			this.#tableHitCount = rows
			for (let i = 0; i < rows; i++) {
				const idx = this.#scroll + i
				if (idx >= n) {
					out.push(row("", w))
					continue
				}
				if (this.#kind === "cron") out.push(row(this.#renderCronRow(this.#jobs[idx]!, idx === this.#sel, idx === this.#hoverIdx, inner), w))
				else if (this.#kind === "kanban") out.push(row(this.#renderKanbanRow(this.#tasks[idx]!, idx === this.#sel, idx === this.#hoverIdx, inner), w))
				else out.push(row(this.#renderProfileRow(this.#profiles[idx]!, idx === this.#sel, idx === this.#hoverIdx, inner), w))
			}
		}
		out.push(divider(w))
		// Mini detail
		const detailStart = out.length
		for (const l of this.#renderDetailBody(inner, 6)) {
			out.push(row(l, w))
		}
		if (this.#actionRelStart >= 0) {
			this.#actionStartRow = detailStart + this.#actionRelStart
		}
		out.push(divider(w))
		out.push(row(theme.fg("dim", this.#hint()), w))
		out.push(bottomBorder(w))
		return out
	}
}
