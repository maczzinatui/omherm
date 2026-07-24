/**
 * Hermes port overlays — Kanban / Cron / Profiles.
 *
 * Design: Herm fork table + detail split (Cron.tsx / Kanban list density),
 * painted with OMP overlay chrome (topBorder/splitRow/theme). Not a flat
 * SelectList dump — real columns, selection caret, side KV pane when wide.
 */
import type { Component, TUI } from "@oh-my-pi/pi-tui"
import { matchesKey, visibleWidth } from "@oh-my-pi/pi-tui"
import {
	cronPort,
	kanbanPort,
	profilePort,
	type CronJob,
	type CronSchedulerStatus,
	type KanbanDetail,
	type KanbanTask,
	type ProfileInfo,
} from "@meshina/hermes-bridge"
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

export type HermesPortKind = "kanban" | "cron" | "profiles"

/** Pad plain text to width (no ANSI). */
function pad(s: string, w: number): string {
	if (w <= 0) return ""
	const t = s ?? ""
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

type ConfirmKind = "remove_cron" | null

type FormField = { key: string; label: string; value: string; help?: string }
type FormKind = "cron_create" | "cron_edit" | "kanban_create" | "kanban_assign"

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
	#detail: KanbanDetail | CronJob | null = null
	#detailLines: string[] = []
	#profiles: ProfileInfo[] = []
	#runsPreview: string[] = []

	/** Cached layout from last render */
	#tableRows = 12
	#wide = false

	constructor(tui: TUI, kind: HermesPortKind, onCancel: () => void) {
		this.#tui = tui
		this.#kind = kind
		this.#onCancel = onCancel
		void this.reload()
	}

	async reload(): Promise<void> {
		this.#loading = true
		this.#error = ""
		this.#banner = ""
		this.#tui.requestRender()
		try {
			if (this.#kind === "cron") {
				const [jobs, st] = await Promise.all([
					cronPort.list({ all: true }),
					cronPort.status().catch(() => null),
				])
				this.#jobs = jobs
				this.#cronStatus = st
				if (this.#sel >= jobs.length) this.#sel = Math.max(0, jobs.length - 1)
				await this.#refreshCronDetail()
			} else if (this.#kind === "kanban") {
				this.#tasks = await kanbanPort.list({ limit: 80 })
				if (this.#sel >= this.#tasks.length) this.#sel = Math.max(0, this.#tasks.length - 1)
				await this.#refreshKanbanDetail()
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
			this.#tui.requestRender()
		}
	}

	async #refreshCronDetail(): Promise<void> {
		const j = this.#jobs[this.#sel]
		if (!j) {
			this.#detail = null
			this.#detailLines = []
			this.#runsPreview = []
			return
		}
		const rich = (await cronPort.show(j.id).catch(() => null)) || j
		this.#detail = rich
		this.#detailLines = this.#cronKv(rich)
		// soft load runs (non-blocking feel)
		cronPort
			.runs(j.id, 8)
			.then((rows) => {
				this.#runsPreview = rows.map((r) => r.raw)
				this.#tui.requestRender()
			})
			.catch(() => {
				this.#runsPreview = []
			})
	}

	async #refreshKanbanDetail(): Promise<void> {
		const t = this.#tasks[this.#sel]
		if (!t) {
			this.#detail = null
			this.#detailLines = []
			return
		}
		try {
			const d = await kanbanPort.show(t.id)
			this.#detail = d
			this.#detailLines = this.#kanbanKv(d)
		} catch (e) {
			this.#detail = t
			this.#detailLines = [`error: ${e instanceof Error ? e.message : String(e)}`]
		}
	}

	#cronKv(j: CronJob): string[] {
		const rows: [string, string][] = [
			["ID", j.id],
			["State", j.enabled ? "active" : "paused"],
			["Schedule", j.schedule || "—"],
			["Deliver", j.deliver || "local"],
			["Last", j.last_run ? `${agoLabel(j.last_run)} · ${j.last_status ?? "?"}` : "never"],
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
		if (this.#kind === "cron") return `Cron Jobs (${this.#jobs.length})`
		if (this.#kind === "kanban") return `Kanban (${this.#tasks.length})`
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
			const base = [
				{ id: "create", label: "New job…", desc: "n" },
				{ id: "reload", label: "Reload list", desc: "R" },
				{ id: "close", label: "Close", desc: "Esc" },
			]
			if (!j) return base
			return [
				{ id: "create", label: "New job…", desc: "n" },
				{ id: "edit", label: "Edit job…", desc: "e" },
				{ id: "toggle", label: j.enabled ? "Pause" : "Resume", desc: "p" },
				{ id: "run", label: "Run next tick", desc: "r" },
				{ id: "runs", label: "Refresh runs", desc: "" },
				{ id: "reload", label: "Reload list", desc: "R" },
				{ id: "remove", label: "Delete job…", desc: "d" },
				{ id: "close", label: "Close", desc: "Esc" },
			]
		}
		if (this.#kind === "kanban") {
			const t = this.#tasks[this.#sel]
			const base = [
				{ id: "create", label: "New task…", desc: "n" },
				{ id: "reload", label: "Reload list", desc: "R" },
				{ id: "close", label: "Close", desc: "Esc" },
			]
			if (!t) return base
			return [
				{ id: "create", label: "New task…", desc: "n" },
				{ id: "assign", label: "Assign…", desc: "a" },
				{ id: "promote", label: "Promote → ready", desc: "u" },
				{ id: "complete", label: "Complete", desc: "c" },
				{ id: "block", label: "Block", desc: "b" },
				{ id: "unblock", label: "Unblock", desc: "" },
				{ id: "archive", label: "Archive", desc: "d" },
				{ id: "reload", label: "Reload list", desc: "R" },
				{ id: "close", label: "Close", desc: "Esc" },
			]
		}
		return [
			{ id: "reload", label: "Reload", desc: "R" },
			{ id: "close", label: "Close", desc: "Esc" },
		]
	}

	async #runAction(id: string): Promise<void> {
		this.#banner = ""
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
			if (this.#kind === "cron") {
				const j = this.#jobs[this.#sel]
				if (!j) return
				if (id === "toggle") {
					this.#banner = j.enabled ? await cronPort.pause(j.id) : await cronPort.resume(j.id)
					await this.reload()
					return
				}
				if (id === "run") {
					this.#banner = await cronPort.run(j.id)
					await this.#refreshCronDetail()
					return
				}
				if (id === "runs") {
					await this.#refreshCronDetail()
					this.#banner = "Runs refreshed"
					return
				}
				if (id === "remove") {
					this.#confirm = "remove_cron"
					this.#focus = "confirm"
					this.#actionSel = 0
					this.#tui.requestRender()
					return
				}
			}
			if (this.#kind === "kanban") {
				const t = this.#tasks[this.#sel]
				if (!t) return
				if (id === "promote") this.#banner = await kanbanPort.promote([t.id])
				else if (id === "complete") this.#banner = await kanbanPort.complete([t.id])
				else if (id === "block") this.#banner = await kanbanPort.block([t.id])
				else if (id === "unblock") this.#banner = await kanbanPort.unblock([t.id])
				else if (id === "archive") this.#banner = await kanbanPort.archive([t.id])
				await this.reload()
			}
		} catch (e) {
			this.#banner = e instanceof Error ? e.message : String(e)
		}
		this.#tui.requestRender()
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
		this.#tui.requestRender()
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
		this.#tui.requestRender()
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
		this.#tui.requestRender()
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
		this.#tui.requestRender()
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
					this.#tui.requestRender()
					return
				}
				if (!prompt) {
					f.error = "prompt required"
					this.#tui.requestRender()
					return
				}
				this.#banner = await cronPort.create({
					schedule,
					prompt,
					name: get("name") || undefined,
					deliver: get("deliver") || undefined,
				})
			} else if (f.kind === "cron_edit" && f.targetId) {
				const schedule = get("schedule")
				if (!schedule) {
					f.error = "schedule required"
					this.#tui.requestRender()
					return
				}
				this.#banner = await cronPort.edit(f.targetId, {
					schedule,
					prompt: get("prompt") || undefined,
					name: get("name") || undefined,
					deliver: get("deliver") || undefined,
				})
			} else if (f.kind === "kanban_create") {
				const title = get("title")
				if (!title) {
					f.error = "title required"
					this.#tui.requestRender()
					return
				}
				this.#banner = await kanbanPort.create({
					title,
					body: get("body") || undefined,
					assignee: get("assignee") || undefined,
				})
			} else if (f.kind === "kanban_assign" && f.targetId) {
				const who = get("assignee") || "unassigned"
				this.#banner = await kanbanPort.assign(f.targetId, who)
			}
			this.#form = null
			this.#focus = "table"
			await this.reload()
		} catch (e) {
			f.error = e instanceof Error ? e.message : String(e)
			this.#tui.requestRender()
		}
	}

	handleInput(data: string): void {
		if (matchesSelectCancel(data)) {
			if (this.#focus === "form") {
				this.#form = null
				this.#focus = "table"
				this.#tui.requestRender()
				return
			}
			if (this.#focus === "confirm") {
				this.#confirm = null
				this.#focus = "table"
				this.#tui.requestRender()
				return
			}
			if (this.#focus === "actions") {
				this.#focus = "table"
				this.#tui.requestRender()
				return
			}
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
				this.#tui.requestRender()
				return
			}
			if (matchesSelectUp(data)) {
				form.idx = (form.idx + form.fields.length - 1) % form.fields.length
				form.editing = true
				this.#tui.requestRender()
				return
			}
			if (matchesSelectDown(data)) {
				form.idx = (form.idx + 1) % form.fields.length
				form.editing = true
				this.#tui.requestRender()
				return
			}
			// Ctrl+Enter submit (often arrives as \n with control — also bare enter when last field)
			if (matchesKey(data, "enter") || matchesKey(data, "return") || data === "\n" || data === "\r") {
				if (form.idx === form.fields.length - 1) {
					void this.#submitForm()
				} else {
					form.idx = form.idx + 1
					form.editing = true
					this.#tui.requestRender()
				}
				return
			}
			// backspace
			if (data === "\x7f" || data === "\b") {
				field.value = field.value.slice(0, -1)
				this.#tui.requestRender()
				return
			}
			// printable
			if (data.length === 1 && data >= " ") {
				field.value += data
				this.#tui.requestRender()
				return
			}
			// multi-char paste
			if (data.length > 1 && !data.includes("\x1b")) {
				field.value += data.replace(/\r/g, "")
				this.#tui.requestRender()
			}
			return
		}

		// Confirm dialog
		if (this.#focus === "confirm") {
			if (matchesSelectUp(data) || matchesSelectDown(data)) {
				this.#actionSel = this.#actionSel === 0 ? 1 : 0
				this.#tui.requestRender()
				return
			}
			if (matchesKey(data, "enter") || matchesKey(data, "return") || data === "\n") {
				void (async () => {
					if (this.#actionSel === 1 && this.#confirm === "remove_cron") {
						const j = this.#jobs[this.#sel]
						if (j) {
							try {
								this.#banner = await cronPort.remove(j.id)
							} catch (e) {
								this.#banner = e instanceof Error ? e.message : String(e)
							}
						}
					}
					this.#confirm = null
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
		if (data === "	") {
			// Tab toggles table ↔ actions when detail exists
			if (this.#count() > 0) {
				this.#focus = this.#focus === "table" ? "actions" : "table"
				this.#actionSel = 0
				this.#tui.requestRender()
			}
			return
		}

		if (this.#focus === "actions") {
			const acts = this.#actions()
			if (matchesSelectUp(data)) {
				this.#actionSel = (this.#actionSel + acts.length - 1) % acts.length
				this.#tui.requestRender()
				return
			}
			if (matchesSelectDown(data)) {
				this.#actionSel = (this.#actionSel + 1) % acts.length
				this.#tui.requestRender()
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
			if (data === "r") {
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
			if (data === "b") {
				void this.#runAction("block")
				return
			}
			if (data === "d") {
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
			this.#tui.requestRender()
		}
	}

	async #onSelChange(): Promise<void> {
		this.#clampScroll()
		if (this.#kind === "cron") await this.#refreshCronDetail()
		else if (this.#kind === "kanban") await this.#refreshKanbanDetail()
		this.#tui.requestRender()
	}

	// ── render helpers ──────────────────────────────────────────

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

	#renderCronRow(j: CronJob, selected: boolean, inner: number): string {
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
		return selected ? theme.bg("selectedBg", fit(line, inner)) : fit(line, inner)
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

	#renderKanbanRow(t: KanbanTask, selected: boolean, inner: number): string {
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
		return selected ? theme.bg("selectedBg", fit(line, inner)) : fit(line, inner)
	}

	#renderProfileRow(p: ProfileInfo, selected: boolean, inner: number): string {
		const caret = selected ? theme.fg("accent", "▸ ") : "  "
		const mark = p.is_active ? theme.fg("success", "● ") : theme.fg("dim", "○ ")
		const name = pad(p.name + (p.is_sticky ? " *" : ""), Math.min(24, Math.floor(inner * 0.35)))
		const rest = [p.model, p.provider].filter(Boolean).join(" · ")
		const line = caret + mark + (selected ? theme.bold(theme.fg("accent", name)) : name) + " " + theme.fg("dim", rest)
		return selected ? theme.bg("selectedBg", fit(line, inner)) : fit(line, inner)
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
				lines.push(theme.fg("dim", "Recent runs"))
				for (const r of this.#runsPreview) {
					if (lines.length >= maxLines) break
					lines.push(fit(theme.fg("dim", r), bodyW))
				}
			}
		}
		// Actions footer in detail
		if (this.#focus === "actions" || !this.#wide) {
			lines.push("")
			lines.push(theme.fg("dim", this.#focus === "actions" ? "Actions (Enter)" : "Enter · actions"))
			const acts = this.#actions()
			for (let i = 0; i < acts.length && lines.length < maxLines; i++) {
				const a = acts[i]!
				const sel = this.#focus === "actions" && i === this.#actionSel
				const mark = sel ? theme.fg("accent", "▸ ") : "  "
				const lab = sel ? theme.bold(theme.fg("accent", a.label)) : theme.fg("text", a.label)
				const desc = a.desc ? theme.fg("dim", `  ${a.desc}`) : ""
				lines.push(fit(mark + lab + desc, bodyW))
			}
		}
		while (lines.length < maxLines) lines.push("")
		return lines.slice(0, maxLines)
	}

	#hint(): string {
		if (this.#kind === "cron") {
			return "↑↓ nav  n new  e edit  Enter actions  p pause  r run  d del  R reload  Esc"
		}
		if (this.#kind === "kanban") {
			return "↑↓ nav  n new  a assign  Enter actions  u/c/b/d  R reload  Esc"
		}
		return "↑↓ nav  R reload  Esc close · switch: hermes profile use"
	}

	render(width: number): string[] {
		const w = Math.max(40, width)
		this.#wide = w >= 100 && this.#kind !== "profiles"

		// Vertical budget from terminal when available (OMP overlay is % of screen).
		const termRows = typeof process !== "undefined" && process.stdout?.rows ? process.stdout.rows : 36
		const chrome = this.#wide ? 7 : 12
		this.#tableRows = Math.max(6, Math.min(22, termRows - chrome - 4))
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
			out.push(row(theme.fg("dim", "↑↓ fields  type  Enter next/save  Esc cancel"), w))
			if (form.error) out.push(row(theme.fg("error", form.error.slice(0, w - 6)), w))
			out.push(divider(w))
			const inner = Math.max(20, w - 4)
			for (let i = 0; i < form.fields.length; i++) {
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
			out.push(topBorder(w, "Confirm delete"))
			const j = this.#jobs[this.#sel]
			out.push(row(theme.fg("warning", `Delete "${j?.name || j?.id || "?"}"? This cannot be undone.`), w))
			out.push(row("", w))
			out.push(row((this.#actionSel === 0 ? theme.fg("accent", "▸ ") : "  ") + "Cancel", w))
			out.push(row((this.#actionSel === 1 ? theme.fg("error", "▸ ") : "  ") + theme.fg("error", "Yes, delete permanently"), w))
			out.push(row(theme.fg("dim", "↑↓  Enter  Esc"), w))
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

			out.push(topBorderSplit(w, this.#title(), sideW))
			out.push(splitRow(fit(statusLine, sideW), fit(theme.fg("dim", "Detail"), bodyW), w, sideW))
			if (this.#banner) {
				out.push(splitRow(fit(theme.fg("accent", this.#banner.slice(0, sideW)), sideW), "", w, sideW))
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

			if (n === 0) {
				const empty =
					this.#kind === "cron"
						? theme.fg("dim", "No jobs — hermes cron create '30m' '…'")
						: theme.fg("dim", "No tasks")
				for (let i = 0; i < rows; i++) {
					out.push(splitRow(i === 0 ? fit(empty, sideW) : "", fit(detailLines[i] || "", bodyW), w, sideW))
				}
			} else {
				for (let i = 0; i < rows; i++) {
					const idx = this.#scroll + i
					let left = ""
					if (idx < n) {
						if (this.#kind === "cron") left = this.#renderCronRow(this.#jobs[idx]!, idx === this.#sel, tableInner)
						else if (this.#kind === "kanban") left = this.#renderKanbanRow(this.#tasks[idx]!, idx === this.#sel, tableInner)
						else left = this.#renderProfileRow(this.#profiles[idx]!, idx === this.#sel, tableInner)
					}
					out.push(splitRow(fit(left, sideW), fit(detailLines[i] || "", bodyW), w, sideW))
				}
			}

			out.push(dividerSplit(w, sideW))
			out.push(splitRow(fit(theme.fg("dim", this.#hint()), sideW), fit(theme.fg("dim", this.#focus === "actions" ? "ACTIONS" : "Tab → actions"), bodyW), w, sideW))
			out.push(bottomBorder(w)) // bottomBorder is full width - need split bottom
			// Fix: bottom should be split too - use divider style bottom
			out[out.length - 1] = (() => {
				const box = theme.boxRound
				const paint = (s: string) => theme.fg("border", s)
				const divCol = sideW + 3
				const leftLen = Math.max(0, divCol - 1)
				const rightLen = Math.max(0, w - 2 - divCol)
				return paint(box.bottomLeft + box.horizontal.repeat(leftLen) + box.teeUp + box.horizontal.repeat(rightLen) + box.bottomRight)
			})()
			return out
		}

		// Narrow: stacked table then detail snippet
		out.push(topBorder(w, this.#title()))
		out.push(row(statusLine, w))
		if (this.#banner) out.push(row(theme.fg("accent", this.#banner.slice(0, w - 6)), w))
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
			for (let i = 0; i < rows; i++) {
				const idx = this.#scroll + i
				if (idx >= n) {
					out.push(row("", w))
					continue
				}
				if (this.#kind === "cron") out.push(row(this.#renderCronRow(this.#jobs[idx]!, idx === this.#sel, inner), w))
				else if (this.#kind === "kanban") out.push(row(this.#renderKanbanRow(this.#tasks[idx]!, idx === this.#sel, inner), w))
				else out.push(row(this.#renderProfileRow(this.#profiles[idx]!, idx === this.#sel, inner), w))
			}
		}
		out.push(divider(w))
		// Mini detail
		for (const l of this.#renderDetailBody(inner, 6)) {
			out.push(row(l, w))
		}
		out.push(divider(w))
		out.push(row(theme.fg("dim", this.#hint()), w))
		out.push(bottomBorder(w))
		return out
	}
}
