/**
 * Hermes sessions picker — gateway session.list / session.resume (Cadillac SoT).
 * Discoverable: Settings → Tasks → Open Sessions… · /sessions · /resume · app.session.resume
 */
import type { Component, TUI } from "@oh-my-pi/pi-tui"
import {
	matchesKey,
	routeSgrMouseInput,
	truncateToWidth,
	visibleWidth,
	type SgrMouseEvent,
} from "@oh-my-pi/pi-tui"
import { sessionsPort, type HermesSessionRow } from "@omherm/hermes-bridge"
import { theme } from "../theme/theme"
import { bottomBorder, fit, row, topBorder } from "./overlay-box"
import {
	matchesSelectCancel,
	matchesSelectDown,
	matchesSelectPageDown,
	matchesSelectPageUp,
	matchesSelectUp,
} from "../utils/keybinding-matchers"
import { enableOverlayScopedPaint, paintOverlayLocal } from "../utils/overlay-paint"

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
	return truncateToWidth(t, w)
}

/**
 * One session table row for `innerW` content columns (row() already applies borders).
 * Fixed left meta + flex title/preview + fixed right id — no middle pad bloat,
 * so wide terminals show title/preview instead of empty gap and id is never clipped off.
 */
function formatSessionLine(
	r: HermesSessionListRow,
	innerW: number,
	mark: string,
	opts?: { header?: boolean },
): string {
	const whenW = 5
	const msgsW = 4
	const srcW = Math.min(12, Math.max(6, Math.floor(innerW * 0.12)))
	// Short id always reserved on the right so resume identity stays visible.
	const idRaw = (r.id || "").trim()
	const idShow =
		idRaw.length === 0 ? "—" : idRaw.length > 14 ? `${idRaw.slice(0, 12)}…` : idRaw
	const idW = Math.min(16, Math.max(8, visibleWidth(idShow)))

	if (opts?.header) {
		const left = `${" ".repeat(1)} ${pad("when", whenW)} ${pad("msgs", msgsW)} ${pad("source", srcW)}`
		const right = pad("id", idW)
		const midBudget = Math.max(8, innerW - visibleWidth(left) - visibleWidth(right) - 2)
		const mid = pad("title · preview", midBudget)
		return fit(`${left} ${mid} ${right}`, innerW)
	}

	const when = pad(r.when || relTime(r.startedAt), whenW)
	const msgs = pad(String(r.messageCount > 0 ? r.messageCount : "·"), msgsW)
	const src = pad((r.source || "—").replace(/\s+/g, " ").trim().slice(0, srcW), srcW)
	const left = `${mark} ${when} ${msgs} ${src}`
	const right = pad(idShow, idW)
	const gap = 2
	const midBudget = Math.max(8, innerW - visibleWidth(left) - visibleWidth(right) - gap)

	const title = (r.title || "(untitled)").replace(/\s+/g, " ").trim() || "(untitled)"
	const preview = (r.preview || "").replace(/\s+/g, " ").trim()
	let midPlain = title
	// Only append preview when it still leaves title readable (≥ half mid or 12 cols).
	if (preview && midBudget >= 20) {
		const titleMax = Math.max(12, Math.floor(midBudget * 0.55))
		const tBit = truncateToWidth(title, titleMax)
		const rest = midBudget - visibleWidth(tBit) - 3
		if (rest >= 8) {
			midPlain = `${tBit} · ${truncateToWidth(preview, rest)}`
		} else {
			midPlain = truncateToWidth(title, midBudget)
		}
	} else {
		midPlain = truncateToWidth(title, midBudget)
	}
	// Left-align mid; pad only the remainder so selection bg is full-width without a hollow center.
	const midPad = Math.max(0, midBudget - visibleWidth(midPlain))
	const mid = midPlain + (midPad > 0 ? " ".repeat(midPad) : "")
	return fit(`${left} ${mid} ${right}`, innerW)
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
	#pendingHoverIdx = -1
	#hoverPaintTimer: ReturnType<typeof setTimeout> | null = null

	constructor(tui: TUI, onCancel: () => void, opts: HermesSessionsListOptions) {
		this.#tui = tui
		this.#onCancel = onCancel
		this.#opts = opts
		enableOverlayScopedPaint(this.#tui, this)
		void this.reload()
	}

	#paint(): void {
		paintOverlayLocal(this.#tui, this)
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
			// routeSgrMouseInput(data, handler) — second arg required (pi-tui).
			// Old call site passed only data → TypeError: handler is not a function
			// on any SGR mouse while the sessions overlay was open.
			if (routeSgrMouseInput(data, (event) => this.#onMouse(event))) {
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

	/** Consume pi-tui SgrMouseEvent (motion / wheel / leftClick — not kind/button strings). */
	#onMouse(ev: SgrMouseEvent): boolean {
		try {
			if (ev.release) return true

			if (ev.motion) {
				if (ev.row >= this.#tableStartRow && ev.row < this.#tableStartRow + this.#tableHitCount) {
					const idx = this.#scroll + (ev.row - this.#tableStartRow)
					if (idx >= 0 && idx < this.#rows.length && idx !== this.#hoverIdx) {
						this.#pendingHoverIdx = idx
						if (this.#hoverPaintTimer == null) {
							this.#hoverPaintTimer = setTimeout(() => {
								this.#hoverPaintTimer = null
								if (this.#pendingHoverIdx >= 0 && this.#pendingHoverIdx !== this.#hoverIdx) {
									this.#hoverIdx = this.#pendingHoverIdx
									this.#paint()
								}
							}, 16)
						}
					}
				} else if (this.#hoverIdx !== -1 || this.#pendingHoverIdx !== -1) {
					this.#hoverIdx = -1
					this.#pendingHoverIdx = -1
					if (this.#hoverPaintTimer != null) {
						clearTimeout(this.#hoverPaintTimer)
						this.#hoverPaintTimer = null
					}
					this.#paint()
				}
				return true
			}

			if (ev.wheel != null) {
				const n = this.#rows.length
				if (n === 0) return true
				// wheel: -1 up, 1 down
				if (ev.wheel < 0) this.#sel = Math.max(0, this.#sel - 1)
				else this.#sel = Math.min(n - 1, this.#sel + 1)
				this.#clamp()
				this.#paint()
				return true
			}

			if (ev.leftClick) {
				if (ev.row >= this.#tableStartRow && ev.row < this.#tableStartRow + this.#tableHitCount) {
					const idx = this.#scroll + (ev.row - this.#tableStartRow)
					if (idx >= 0 && idx < this.#rows.length) {
						this.#sel = idx
						void this.#resumeSelected()
					}
				}
				return true
			}
		} catch {
			/* never take down TUI */
		}
		return true
	}

	render(width: number): string[] {
		try {
			const w = Math.max(40, Math.floor(width) || 80)
			const termRows = Math.max(12, process.stdout.rows || 24)
			const inner = Math.max(20, w - 4)
			const out: string[] = []
			// topBorder(width, title) — not (title, width)
			out.push(topBorder(w, `Sessions (${this.#rows.length})${this.#loading ? " …" : ""}`))
			if (this.#sourceNote) out.push(row(safeFg("dim", fit(this.#sourceNote, inner)), w))
			if (this.#error) out.push(row(safeFg("error", fit(this.#error, inner)), w))
			if (this.#banner) out.push(row(safeFg("accent", fit(this.#banner, inner)), w))
			out.push(
				row(
					safeFg(
						"dim",
						formatSessionLine(
							{
								id: "",
								title: "",
								preview: "",
								source: "",
								messageCount: 0,
								startedAt: 0,
								when: "",
							},
							inner,
							" ",
							{ header: true },
						),
					),
					w,
				),
			)

			this.#tableStartRow = out.length
			const bodyBudget = Math.max(4, termRows - out.length - 3)
			// Provisional hit height for scroll clamp; refined after paint for clicks.
			this.#tableHitCount = Math.min(bodyBudget, Math.max(1, this.#rows.length))
			this.#clamp()

			if (this.#loading && this.#rows.length === 0) {
				this.#tableHitCount = 0
				out.push(row(safeFg("dim", "Loading Hermes sessions…"), w))
			} else if (this.#rows.length === 0) {
				this.#tableHitCount = 0
				out.push(row(safeFg("dim", "No sessions found."), w))
			} else {
				const end = Math.min(this.#rows.length, this.#scroll + bodyBudget)
				const paintedRows = Math.max(0, end - this.#scroll)
				// Hit-test only real session rows (not empty chrome padding below).
				this.#tableHitCount = paintedRows
				for (let i = this.#scroll; i < end; i++) {
					const r = this.#rows[i]!
					const sel = i === this.#sel
					const hover = i === this.#hoverIdx && !sel
					const mark = sel ? "›" : hover ? "·" : " "
					const line = formatSessionLine(r, inner, mark)
					out.push(row(sel ? safeBg(line) : hover ? safeFg("accent", line) : line, w))
				}
				// Pad remaining body so fullscreen isn't a floating short strip.
				for (let p = paintedRows; p < bodyBudget && out.length < termRows - 2; p++) {
					out.push(row("", w))
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
