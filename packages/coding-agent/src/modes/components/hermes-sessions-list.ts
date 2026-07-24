/**
 * Hermes sessions picker — gateway session.list / session.resume (Cadillac SoT).
 * Discoverable: Settings → Tasks → Open Sessions… · /sessions · /resume · app.session.resume
 */
import type { Component, TUI } from "@oh-my-pi/pi-tui"
import { matchesKey, routeSgrMouseInput, type SgrMouseEvent, visibleWidth } from "@oh-my-pi/pi-tui"
import { sessionsPort, type HermesSessionRow } from "@meshina/hermes-bridge"
import { theme } from "../theme/theme"
import { bottomBorder, fit, row, topBorder } from "./overlay-box"
import {
	matchesSelectCancel,
	matchesSelectDown,
	matchesSelectPageDown,
	matchesSelectPageUp,
	matchesSelectUp,
} from "../utils/keybinding-matchers"

export type HermesSessionListRow = {
	id: string
	title: string
	preview: string
	source: string
	messageCount: number
	startedAt: number
	when: string
}

export type HermesSessionsBrain = {
	listSessions: (limit?: number) => Promise<
		Array<{
			id: string
			title: string
			preview: string
			started_at: number
			message_count: number
			source: string
		}>
	>
	resumeSession: (sessionId: string) => Promise<{
		session_id: string
		messages?: unknown[]
	}>
	sessionId?: string | null
}

export type HermesSessionsListOptions = {
	brain: HermesSessionsBrain | null
	onResumed?: (info: {
		sessionId: string
		title: string
		messageCount: number
		previewLines: string[]
	}) => void
}

function safeFg(color: "accent" | "dim" | "error" | "success" | "muted" | "warning", text: string): string {
	try {
		return theme.fg(color as never, text)
	} catch {
		return text
	}
}

function safeBg(text: string): string {
	try {
		return theme.bg("selectedBg", text)
	} catch {
		return text
	}
}

function pad(s: string, w: number): string {
	const t = s ?? ""
	const vw = visibleWidth(t)
	if (vw === w) return t
	if (vw < w) return t + " ".repeat(w - vw)
	return fit(t, w)
}

function relTime(ts: number): string {
	if (!ts || ts <= 0) return "—"
	const ms = ts < 1e12 ? ts * 1000 : ts
	const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000))
	if (sec < 60) return `${sec}s`
	if (sec < 3600) return `${Math.floor(sec / 60)}m`
	if (sec < 86400) return `${Math.floor(sec / 3600)}h`
	return `${Math.floor(sec / 86400)}d`
}

function fromCli(r: HermesSessionRow): HermesSessionListRow {
	return {
		id: r.id,
		title: r.title === "—" ? "" : r.title,
		preview: "",
		source: r.workspace === "—" ? "" : r.workspace,
		messageCount: 0,
		startedAt: 0,
		when: r.lastActive || "—",
	}
}

function fromGw(s: {
	id: string
	title: string
	preview: string
	started_at: number
	message_count: number
	source: string
}): HermesSessionListRow {
	return {
		id: s.id,
		title: s.title,
		preview: s.preview,
		source: s.source,
		messageCount: s.message_count,
		startedAt: s.started_at,
		when: relTime(s.started_at),
	}
}

export class HermesSessionsListComponent implements Component {
	#tui: TUI
	#onCancel: () => void
	#opts: HermesSessionsListOptions
	#loading = true
	#error = ""
	#banner = ""
	#sourceNote = ""
	#rows: HermesSessionListRow[] = []
	#sel = 0
	#scroll = 0
	#tableStartRow = 2
	#tableHitCount = 0
	#hoverIdx = -1
	#busy = false

	constructor(tui: TUI, onCancel: () => void, opts: HermesSessionsListOptions) {
		this.#tui = tui
		this.#onCancel = onCancel
		this.#opts = opts
		try {
			this.#tui.enableScopedInputRender?.(this)
		} catch {
			/* optional */
		}
		void this.reload()
	}

	#paint(): void {
		try {
			if (typeof this.#tui.requestComponentRender === "function") {
				this.#tui.requestComponentRender(this)
			} else {
				this.#tui.requestRender()
			}
		} catch {
			try {
				this.#tui.requestRender()
			} catch {
				/* swallow */
			}
		}
	}

	async reload(): Promise<void> {
		this.#loading = this.#rows.length === 0
		this.#error = ""
		this.#paint()
		try {
			const brain = this.#opts.brain
			if (brain) {
				const list = await brain.listSessions(100)
				this.#rows = list
					.filter((s) => (s.message_count ?? 0) > 0 || (s.title || "").trim())
					.map(fromGw)
				this.#sourceNote = "Hermes gateway · Enter resumes SoT session (brain stays Hermes)"
				const cur = brain.sessionId
				if (cur) {
					const i = this.#rows.findIndex((x) => x.id === cur)
					if (i >= 0) this.#sel = i
				}
			} else {
				const list = await sessionsPort.list({ limit: 80 })
				this.#rows = list.map(fromCli)
				this.#sourceNote = "CLI list only (no brain) — resume disabled"
			}
			if (this.#sel >= this.#rows.length) this.#sel = Math.max(0, this.#rows.length - 1)
		} catch (e) {
			// gateway fail → CLI fallback
			try {
				const list = await sessionsPort.list({ limit: 80 })
				this.#rows = list.map(fromCli)
				this.#sourceNote = `gateway failed · CLI fallback · ${e instanceof Error ? e.message : String(e)}`
				this.#error = ""
			} catch (e2) {
				this.#error = e2 instanceof Error ? e2.message : String(e2)
			}
		} finally {
			this.#loading = false
			this.#paint()
		}
	}

	#clamp(): void {
		const n = this.#rows.length
		const vis = this.#tableHitCount || 12
		if (this.#sel < this.#scroll) this.#scroll = this.#sel
		if (this.#sel >= this.#scroll + vis) this.#scroll = this.#sel - vis + 1
		this.#scroll = Math.max(0, Math.min(this.#scroll, Math.max(0, n - vis)))
	}

	handleInput(data: string): void {
		try {
			if (data.startsWith("\x1b[<")) {
				const ev = routeSgrMouseInput(data)
				if (ev) this.#onMouse(ev)
				return
			}
			if (matchesSelectCancel(data) || data === "q") {
				this.#onCancel()
				return
			}
			if (data === "R") {
				void this.reload()
				return
			}
			const n = this.#rows.length
			if (n === 0) return
			if (matchesSelectUp(data)) {
				this.#sel = (this.#sel + n - 1) % n
				this.#clamp()
				this.#paint()
				return
			}
			if (matchesSelectDown(data)) {
				this.#sel = (this.#sel + 1) % n
				this.#clamp()
				this.#paint()
				return
			}
			if (matchesSelectPageUp(data)) {
				this.#sel = Math.max(0, this.#sel - 10)
				this.#clamp()
				this.#paint()
				return
			}
			if (matchesSelectPageDown(data)) {
				this.#sel = Math.min(n - 1, this.#sel + 10)
				this.#clamp()
				this.#paint()
				return
			}
			if (matchesKey(data, "enter") || matchesKey(data, "return") || data === "\n") {
				void this.#resumeSelected()
			}
		} catch (e) {
			this.#banner = e instanceof Error ? e.message : String(e)
			this.#paint()
		}
	}

	async #resumeSelected(): Promise<void> {
		if (this.#busy) return
		const row = this.#rows[this.#sel]
		if (!row) return
		const brain = this.#opts.brain
		if (!brain) {
			this.#banner = "No Hermes brain — cannot resume gateway session"
			this.#paint()
			return
		}
		this.#busy = true
		this.#banner = `Resuming ${row.title || row.id}…`
		this.#paint()
		try {
			const res = await brain.resumeSession(row.id)
			const msgs = res.messages || []
			const previewLines: string[] = []
			for (const m of msgs.slice(-10)) {
				if (!m || typeof m !== "object") continue
				const o = m as Record<string, unknown>
				const role = String(o.role || o.type || "?")
				let content = ""
				if (typeof o.content === "string") content = o.content
				else if (typeof o.text === "string") content = o.text
				else if (Array.isArray(o.content)) {
					content = o.content
						.map((c) => (typeof c === "string" ? c : (c as { text?: string })?.text || ""))
						.join(" ")
				}
				const line = content.replace(/\s+/g, " ").trim().slice(0, 140)
				if (line) previewLines.push(`${role}: ${line}`)
			}
			this.#opts.onResumed?.({
				sessionId: res.session_id,
				title: row.title || row.id,
				messageCount: msgs.length || row.messageCount,
				previewLines,
			})
			this.#onCancel()
		} catch (e) {
			this.#banner = e instanceof Error ? e.message : String(e)
			this.#paint()
		} finally {
			this.#busy = false
		}
	}

	#onMouse(ev: SgrMouseEvent): void {
		try {
			if (ev.kind === "move" || ev.kind === "drag") {
				if (ev.row >= this.#tableStartRow && ev.row < this.#tableStartRow + this.#tableHitCount) {
					const idx = this.#scroll + (ev.row - this.#tableStartRow)
					if (idx >= 0 && idx < this.#rows.length && idx !== this.#hoverIdx) {
						this.#hoverIdx = idx
						this.#paint()
					}
				}
				return
			}
			if (ev.kind === "wheel") {
				if (ev.button === "up") this.#sel = Math.max(0, this.#sel - 1)
				else this.#sel = Math.min(this.#rows.length - 1, this.#sel + 1)
				this.#clamp()
				this.#paint()
				return
			}
			if (ev.kind === "down" && ev.button === "left") {
				if (ev.row >= this.#tableStartRow && ev.row < this.#tableStartRow + this.#tableHitCount) {
					const idx = this.#scroll + (ev.row - this.#tableStartRow)
					if (idx >= 0 && idx < this.#rows.length) {
						this.#sel = idx
						void this.#resumeSelected()
					}
				}
			}
		} catch {
			/* ignore */
		}
	}

	render(width: number): string[] {
		try {
			const w = Math.max(40, Math.floor(width) || 80)
			const termRows = Math.max(12, process.stdout.rows || 24)
			const out: string[] = []
			out.push(topBorder(fit(`Sessions (${this.#rows.length})${this.#loading ? " …" : ""}`, w - 4), w))
			if (this.#sourceNote) out.push(row(safeFg("dim", fit(this.#sourceNote, w - 4)), w))
			if (this.#error) out.push(row(safeFg("error", fit(this.#error, w - 4)), w))
			if (this.#banner) out.push(row(safeFg("accent", fit(this.#banner, w - 4)), w))
			out.push(row(safeFg("dim", "  when  msgs  source   title · id"), w))

			this.#tableStartRow = out.length
			const bodyBudget = Math.max(4, termRows - out.length - 3)
			this.#tableHitCount = bodyBudget
			this.#clamp()

			if (this.#loading && this.#rows.length === 0) {
				out.push(row(safeFg("dim", "Loading Hermes sessions…"), w))
			} else if (this.#rows.length === 0) {
				out.push(row(safeFg("dim", "No sessions found."), w))
			} else {
				const end = Math.min(this.#rows.length, this.#scroll + bodyBudget)
				for (let i = this.#scroll; i < end; i++) {
					const r = this.#rows[i]!
					const sel = i === this.#sel
					const hover = i === this.#hoverIdx && !sel
					const mark = sel ? "›" : hover ? "·" : " "
					const when = pad(r.when || relTime(r.startedAt), 5)
					const msgs = pad(String(r.messageCount || "·"), 4)
					const src = pad((r.source || "—").slice(0, 8), 8)
					const titleBit = fit(r.title || "(untitled)", Math.max(8, w - 42))
					const idBit = safeFg("dim", fit(r.id, 18))
					const line = `${mark} ${when}  ${msgs}  ${src}  ${titleBit}  ${idBit}`
					const fitted = fit(line, w - 2)
					out.push(row(sel ? safeBg(fitted) : hover ? safeFg("accent", fitted) : fitted, w))
				}
			}
			out.push(row(safeFg("dim", "↑↓ · Enter resume · R reload · Esc/q back"), w))
			out.push(bottomBorder(w))
			return out.slice(0, termRows)
		} catch (e) {
			return [`sessions overlay error: ${e instanceof Error ? e.message : String(e)}`]
		}
	}
}
