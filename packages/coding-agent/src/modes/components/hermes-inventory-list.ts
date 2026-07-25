/**
 * Skills / Tools / Memory inventory overlays (P2).
 * Defensive clone of hermes-port-list patterns — never throw out of render/input.
 */
import type { Component, TUI } from "@oh-my-pi/pi-tui"
import { matchesKey, routeSgrMouseInput, type SgrMouseEvent, visibleWidth } from "@oh-my-pi/pi-tui"
import {
	skillsPort,
	toolsPort,
	memoryPort,
	formatSkillDescription,
	formatToolDescription,
	formatMemoryLabel,
	formatMemoryDescription,
	type Skill,
	type Tool,
	type MemoryFile,
	type MemoryStatus,
} from "@omherm/hermes-bridge"
import { theme } from "../theme/theme"
import { bottomBorder, divider, fit, row, topBorder } from "./overlay-box"
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
import {
	overlayActionIndexAt,
	overlayTableIndexAt,
	overlayZoneAt,
	routeOverlayWheel,
	type OverlayZoneGeom,
} from "../utils/overlay-pointer-zones"

export type HermesInventoryKind = "skills" | "tools" | "memory"

function pad(s: string, w: number): string {
	if (w <= 0) return ""
	const t = s ?? ""
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
	return fit(t, w)
}

function safeThemeFg(color: "accent" | "dim" | "error" | "success" | "warning" | "text" | "muted", text: string): string {
	try {
		if (typeof theme === "undefined" || typeof theme.fg !== "function") return text
		return theme.fg(color as never, text)
	} catch {
		return text
	}
}

function safeThemeBg(text: string): string {
	try {
		if (typeof theme === "undefined" || typeof theme.bg !== "function") return text
		return theme.bg("selectedBg", text)
	} catch {
		return text
	}
}

export class HermesInventoryListComponent implements Component {
	#tui: TUI
	#kind: HermesInventoryKind
	#onCancel: () => void

	#loading = true
	#error = ""
	#banner = ""
	#sel = 0
	#scroll = 0
	#focus: "table" | "actions" = "table"
	#actionSel = 0

	#skills: Skill[] = []
	#tools: Tool[] = []
	#memFiles: MemoryFile[] = []
	#memStatus: MemoryStatus | null = null
	#detailLines: string[] = []

	#tableRows = 12
	#tableStartRow = 0
	#tableHitCount = 0
	#actionStartRow = -1
	#actionCount = 0
	#hoverIdx = -1
	#hoverRaf: ReturnType<typeof setTimeout> | null = null
	#pendingHover = -2

	constructor(tui: TUI, kind: HermesInventoryKind, onCancel: () => void) {
		this.#tui = tui
		this.#kind = kind
		this.#onCancel = onCancel
		enableOverlayScopedPaint(this.#tui, this)
		void this.reload()
	}

	#paintLocal(): void {
		paintOverlayLocal(this.#tui, this)
	}

	#paintFull(): void {
		paintOverlayFull(this.#tui)
	}

	async reload(): Promise<void> {
		const cold = this.#count() === 0
		this.#loading = cold
		this.#error = ""
		this.#banner = ""
		if (cold) this.#paintFull()
		try {
			if (this.#kind === "skills") {
				if (!skillsPort || typeof skillsPort.list !== "function") {
					throw new Error("skillsPort unavailable — rebuild/relaunch omh")
				}
				this.#skills = await skillsPort.list()
				if (this.#sel >= this.#skills.length) this.#sel = Math.max(0, this.#skills.length - 1)
			} else if (this.#kind === "tools") {
				if (!toolsPort || typeof toolsPort.list !== "function") {
					throw new Error("toolsPort unavailable — rebuild/relaunch omh")
				}
				this.#tools = await toolsPort.list()
				if (this.#sel >= this.#tools.length) this.#sel = Math.max(0, this.#tools.length - 1)
			} else {
				if (!memoryPort || typeof memoryPort.read !== "function") {
					throw new Error("memoryPort unavailable — rebuild/relaunch omh")
				}
				const [files, st] = await Promise.all([
					memoryPort.read(),
					memoryPort.status().catch(() => null),
				])
				this.#memFiles = files
				this.#memStatus = st
				if (this.#sel >= this.#memFiles.length) this.#sel = Math.max(0, this.#memFiles.length - 1)
			}
			this.#paintDetailFromList()
		} catch (e) {
			this.#error = e instanceof Error ? e.message : String(e)
		} finally {
			this.#loading = false
			paintOverlayReload(this.#tui, this, false)
		}
	}

	#paintDetailFromList(): void {
		try {
			if (this.#kind === "skills") {
				const s = this.#skills[this.#sel]
				if (!s) {
					this.#detailLines = []
					return
				}
				this.#detailLines = [
					`name: ${s.name}`,
					`category: ${s.category || "—"}`,
					`source: ${s.source}`,
					`trust: ${s.trust}`,
					`status: ${s.status}`,
					s.userModified ? "user-modified: yes" : "",
					"",
					formatSkillDescription(s),
				].filter(Boolean)
				return
			}
			if (this.#kind === "tools") {
				const t = this.#tools[this.#sel]
				if (!t) {
					this.#detailLines = []
					return
				}
				this.#detailLines = [
					`name: ${t.name}`,
					`kind: ${t.kind}`,
					`status: ${t.status}`,
					`platform: ${t.platform}`,
					t.description ? `desc: ${t.description}` : "",
					"",
					formatToolDescription(t),
				].filter(Boolean)
				return
			}
			const f = this.#memFiles[this.#sel]
			const st = this.#memStatus
			const head = st
				? [
						`provider: ${st.provider}`,
						`plugin: ${st.plugin}`,
						`built-in: ${st.builtInActive ? "active" : "off"}`,
						st.installedPlugins.length
							? `installed: ${st.installedPlugins.join(", ")}`
							: "installed: (none)",
						"",
					]
				: []
			if (!f) {
				this.#detailLines = head
				return
			}
			const body = f.content ? f.content.split(/\r?\n/).slice(0, 24) : ["(file missing or empty)"]
			this.#detailLines = [
				...head,
				formatMemoryDescription(f),
				`path: ${f.path}`,
				`exists: ${f.exists}`,
				`bytes: ${f.bytes}  chars: ${f.chars}  lines: ${f.lines}`,
				f.mtime ? `mtime: ${f.mtime}` : "",
				"",
				...body,
				f.lines > 24 ? `…(${f.lines - 24} more lines)` : "",
			].filter((l) => l !== undefined && l !== "")
		} catch (e) {
			this.#detailLines = [`detail error: ${e instanceof Error ? e.message : String(e)}`]
		}
	}

	#count(): number {
		if (this.#kind === "skills") return this.#skills.length
		if (this.#kind === "tools") return this.#tools.length
		return this.#memFiles.length
	}

	#title(): string {
		if (this.#kind === "skills") return `Skills (${this.#skills.length})`
		if (this.#kind === "tools") return `Tools (${this.#tools.length})`
		return `Memory (${this.#memFiles.length})`
	}

	#clampScroll(): void {
		const n = this.#count()
		const vis = this.#tableRows
		if (this.#sel < this.#scroll) this.#scroll = this.#sel
		if (this.#sel >= this.#scroll + vis) this.#scroll = this.#sel - vis + 1
		this.#scroll = Math.max(0, Math.min(this.#scroll, Math.max(0, n - vis)))
	}

	#actions(): { id: string; label: string; desc: string }[] {
		const back = { id: "close", label: "Close", desc: "Esc/q" }
		const reload = { id: "reload", label: "Reload", desc: "R" }
		if (this.#kind === "memory") return [reload, back]
		if (this.#kind === "skills") {
			const s = this.#skills[this.#sel]
			if (!s) return [reload, back]
			return [
				{
					id: "toggle",
					label: s.status === "enabled" ? "Disable" : "Enable",
					desc: "e",
				},
				{ id: "inspect", label: "Inspect…", desc: "i" },
				reload,
				back,
			]
		}
		const t = this.#tools[this.#sel]
		if (!t) return [reload, back]
		return [
			{
				id: "toggle",
				label: t.status === "enabled" ? "Disable" : "Enable",
				desc: "e",
			},
			reload,
			back,
		]
	}

	async #runAction(id: string): Promise<void> {
		this.#banner = ""
		try {
			if (id === "close") {
				this.#onCancel()
				return
			}
			if (id === "reload") {
				await this.reload()
				return
			}
			if (this.#kind === "skills") {
				const s = this.#skills[this.#sel]
				if (!s) return
				if (id === "toggle") {
					this.#banner =
						s.status === "enabled"
							? await skillsPort.disable(s.name)
							: await skillsPort.enable(s.name)
					await this.reload()
					return
				}
				if (id === "inspect") {
					const text = await skillsPort.inspect(s.name)
					this.#detailLines = [
						...this.#detailLines.slice(0, 6),
						"",
						"—— inspect ——",
						...text.split(/\r?\n/).slice(0, 24),
					]
					this.#banner = "Inspect loaded"
					this.#paintLocal()
					return
				}
			}
			if (this.#kind === "tools") {
				const t = this.#tools[this.#sel]
				if (!t) return
				const plat = t.platform === "default" ? undefined : t.platform
				if (id === "toggle") {
					this.#banner =
						t.status === "enabled"
							? await toolsPort.disable(t.name, plat)
							: await toolsPort.enable(t.name, plat)
					await this.reload()
					return
				}
			}
		} catch (e) {
			this.#banner = e instanceof Error ? e.message : String(e)
		}
		this.#paintLocal()
	}

	handleInput(data: string): void {
		try {
			// routeSgrMouseInput(data, handler) — second arg required (pi-tui).
			// Passing only data → TypeError: handler is not a function on any
			// SGR mouse while Skills/Tools/Memory inventory is open.
			if (routeSgrMouseInput(data, (event) => this.#onMouse(event))) {
				return
			}
			if (matchesSelectCancel(data) || matchesKey(data, "q") || matchesKey(data, "Q") || matchesKey(data, "escape")) {
				if (this.#focus === "actions") {
					this.#focus = "table"
					this.#paintLocal()
					return
				}
				this.#onCancel()
				return
			}
			if (matchesKey(data, "R") || matchesKey(data, "r")) {
				void this.reload()
				return
			}
			if (this.#focus === "table") {
				if (matchesSelectUp(data)) {
					this.#sel = Math.max(0, this.#sel - 1)
					this.#clampScroll()
					this.#paintDetailFromList()
					this.#paintLocal()
					return
				}
				if (matchesSelectDown(data)) {
					this.#sel = Math.min(Math.max(0, this.#count() - 1), this.#sel + 1)
					this.#clampScroll()
					this.#paintDetailFromList()
					this.#paintLocal()
					return
				}
				if (matchesSelectPageUp(data)) {
					this.#sel = Math.max(0, this.#sel - this.#tableRows)
					this.#clampScroll()
					this.#paintDetailFromList()
					this.#paintLocal()
					return
				}
				if (matchesSelectPageDown(data)) {
					this.#sel = Math.min(Math.max(0, this.#count() - 1), this.#sel + this.#tableRows)
					this.#clampScroll()
					this.#paintDetailFromList()
					this.#paintLocal()
					return
				}
				if (matchesKey(data, "Tab") || matchesKey(data, "Enter")) {
					this.#focus = "actions"
					this.#actionSel = 0
					this.#paintLocal()
					return
				}
				if ((matchesKey(data, "e") || matchesKey(data, "E")) && this.#kind !== "memory") {
					void this.#runAction("toggle")
					return
				}
				if ((matchesKey(data, "i") || matchesKey(data, "I")) && this.#kind === "skills") {
					void this.#runAction("inspect")
					return
				}
				return
			}
			const acts = this.#actions()
			if (matchesSelectUp(data)) {
				this.#actionSel = Math.max(0, this.#actionSel - 1)
				this.#paintLocal()
				return
			}
			if (matchesSelectDown(data)) {
				this.#actionSel = Math.min(Math.max(0, acts.length - 1), this.#actionSel + 1)
				this.#paintLocal()
				return
			}
			if (matchesKey(data, "Enter")) {
				const a = acts[this.#actionSel]
				if (a) void this.#runAction(a.id)
			}
		} catch (e) {
			this.#banner = e instanceof Error ? e.message : String(e)
			this.#paintLocal()
		}
	}

	#geom(): OverlayZoneGeom {
		return {
			tableStart: this.#tableStartRow,
			tableHit: this.#tableHitCount,
			actionStart: this.#actionStartRow,
			actionCount: this.#actionCount,
		}
	}

	#wheelTable(delta: -1 | 1): void {
		const n = this.#count()
		if (n === 0) {
			this.#paintLocal()
			return
		}
		const next = Math.max(0, Math.min(n - 1, this.#sel + delta))
		this.#focus = "table"
		if (next !== this.#sel) {
			this.#sel = next
			this.#clampScroll()
			this.#paintDetailFromList()
			this.#paintFull()
		} else {
			this.#paintLocal()
		}
	}

	#wheelActions(delta: -1 | 1): void {
		const acts = this.#actions()
		if (!acts.length) return
		this.#focus = "actions"
		this.#actionSel = Math.max(0, Math.min(acts.length - 1, this.#actionSel + delta))
		this.#paintLocal()
	}

	/**
	 * Shared CADILLAC contract (`overlay-pointer-zones`): wheel/hover/click follow
	 * pointer hit-test — never sticky #focus from a prior region.
	 */
	#onMouse(ev: SgrMouseEvent): boolean {
		try {
			if (ev.release) return true

			const geom = this.#geom()
			const zone = overlayZoneAt(ev.row, geom, ev.col)

			if (ev.motion) {
				if (zone === "table") {
					if (this.#focus !== "table") this.#focus = "table"
					const idx = overlayTableIndexAt(ev.row, geom, this.#scroll, this.#count())
					if (idx != null && idx !== this.#hoverIdx) {
						this.#pendingHover = idx
						if (this.#hoverRaf == null) {
							this.#hoverRaf = setTimeout(() => {
								this.#hoverRaf = null
								if (this.#pendingHover >= 0 && this.#pendingHover !== this.#hoverIdx) {
									this.#hoverIdx = this.#pendingHover
									this.#paintLocal()
								}
							}, 16)
						}
					}
				} else if (zone === "actions") {
					const aidx = overlayActionIndexAt(ev.row, geom)
					if (aidx == null) return true
					if (aidx !== this.#actionSel || this.#focus !== "actions" || this.#hoverIdx !== -1) {
						this.#focus = "actions"
						this.#actionSel = aidx
						this.#hoverIdx = -1
						this.#pendingHover = -2
						if (this.#hoverRaf != null) {
							clearTimeout(this.#hoverRaf)
							this.#hoverRaf = null
						}
						this.#paintLocal()
					}
				} else if (this.#hoverIdx !== -1) {
					this.#hoverIdx = -1
					this.#pendingHover = -2
					if (this.#hoverRaf != null) {
						clearTimeout(this.#hoverRaf)
						this.#hoverRaf = null
					}
					this.#paintLocal()
				}
				return true
			}

			if (ev.wheel != null) {
				this.#hoverIdx = -1
				routeOverlayWheel(zone, ev.wheel, {
					table: (d) => this.#wheelTable(d),
					actions: (d) => this.#wheelActions(d),
					// detail/other → table list
				})
				return true
			}

			if (ev.leftClick) {
				if (zone === "actions") {
					const aidx = overlayActionIndexAt(ev.row, geom)
					if (aidx == null) return true
					this.#focus = "actions"
					this.#actionSel = aidx
					const a = this.#actions()[aidx]
					if (a) void this.#runAction(a.id)
					else this.#paintLocal()
					return true
				}
				if (zone === "table") {
					const idx = overlayTableIndexAt(ev.row, geom, this.#scroll, this.#count())
					if (idx != null) {
						const reTap = idx === this.#sel && this.#focus === "table"
						this.#sel = idx
						this.#focus = "table"
						this.#hoverIdx = -1
						this.#clampScroll()
						this.#paintDetailFromList()
						this.#paintLocal()
						if (reTap && this.#kind !== "memory") {
							void this.#runAction("toggle")
						}
					}
					return true
				}
			}
		} catch {
			/* never take down TUI on mouse faults */
		}
		return true
	}

	/**
	 * Full-width selection band. Selected rows MUST be plain text (no nested SGR):
	 * wrapping theme.bg around mid-line success/dim resets left bg only on the
	 * `#` prefix in some terminals — looked like "highlight only hits the #".
	 */
	#band(plainOrStyled: string, sel: boolean, hover: boolean, w: number): string {
		const fitted = fit(plainOrStyled, w)
		if (sel) {
			try {
				if (typeof theme?.bg === "function" && typeof theme?.fg === "function") {
					// bold+accent on full padded width so the whole row reads as selected
					const body =
						typeof theme.bold === "function" ? theme.bold(theme.fg("accent", fitted)) : theme.fg("accent", fitted)
					return theme.bg("selectedBg", body)
				}
			} catch {
				/* fall through */
			}
			return safeThemeBg(fitted)
		}
		if (hover) {
			try {
				if (typeof theme?.bg === "function") {
					return theme.bg("selectedBg", theme.fg("accent", fitted))
				}
			} catch {
				/* fall through */
			}
			return safeThemeFg("accent", fitted)
		}
		return fitted
	}

	#idxMark(idx: number, sel: boolean, hover: boolean): string {
		const n = pad(String(idx + 1), 3)
		if (sel) return `›${n}`
		if (hover) return `·${n}`
		return ` ${n}`
	}

	#renderSkillRow(s: Skill, sel: boolean, hover: boolean, w: number, idx: number): string {
		const mark = this.#idxMark(idx, sel, hover)
		const st = s.status === "enabled" ? "on " : s.status === "disabled" ? "off" : " ? "
		const nameW = Math.max(8, Math.min(28, w - 22))
		const name = pad(s.name, nameW)
		const src = pad(s.source, 8)
		// Selected/hover: plain line → full-width band (no nested SGR).
		if (sel || hover) {
			return this.#band(`${mark} ${st} ${name} ${src}`, sel, hover, w)
		}
		const stc =
			s.status === "enabled"
				? safeThemeFg("success", st)
				: s.status === "disabled"
					? safeThemeFg("dim", st)
					: safeThemeFg("warning", st)
		return this.#band(`${mark} ${stc} ${name} ${safeThemeFg("dim", src)}`, false, false, w)
	}

	#renderToolRow(t: Tool, sel: boolean, hover: boolean, w: number, idx: number): string {
		const mark = this.#idxMark(idx, sel, hover)
		const st = t.status === "enabled" ? "on " : t.status === "disabled" ? "off" : pad(t.status, 3)
		const kind = pad(t.kind === "mcp-server" ? "mcp" : "bin", 4)
		const nameW = Math.max(8, Math.min(28, w - 22))
		const name = pad(t.name, nameW)
		const plat = pad(String(t.platform), 8)
		if (sel || hover) {
			return this.#band(`${mark} ${st} ${kind} ${name} ${plat}`, sel, hover, w)
		}
		const stc =
			t.status === "enabled"
				? safeThemeFg("success", st)
				: t.status === "disabled"
					? safeThemeFg("dim", st)
					: safeThemeFg("warning", st)
		return this.#band(
			`${mark} ${stc} ${safeThemeFg("dim", kind)} ${name} ${safeThemeFg("dim", plat)}`,
			false,
			false,
			w,
		)
	}

	#renderMemRow(f: MemoryFile, sel: boolean, hover: boolean, w: number, idx: number): string {
		const mark = this.#idxMark(idx, sel, hover)
		const label = formatMemoryLabel(f)
		if (sel || hover) {
			return this.#band(`${mark} ${label}`, sel, hover, w)
		}
		return this.#band(`${mark} ${label}`, false, false, w)
	}

	render(width: number): string[] {
		try {
			const w = Math.max(40, Math.floor(width) || 80)
			const termRows =
				typeof process !== "undefined" && process.stdout?.rows ? process.stdout.rows : 36
			this.#tableRows = Math.max(6, Math.min(20, termRows - 14))
			this.#clampScroll()

			const out: string[] = []
			out.push(topBorder(w, this.#title()))

			if (this.#banner) out.push(row(safeThemeFg("accent", this.#banner.slice(0, Math.max(0, w - 6))), w))
			if (this.#error) {
				out.push(row(safeThemeFg("error", this.#error.slice(0, Math.max(0, w - 6))), w))
				out.push(row(safeThemeFg("dim", "Esc close · R retry"), w))
				out.push(bottomBorder(w))
				return out
			}
			if (this.#loading) {
				out.push(row(safeThemeFg("dim", "Loading…"), w))
				out.push(bottomBorder(w))
				return out
			}

			out.push(divider(w))
			const inner = Math.max(0, w - 4)
			if (this.#kind === "skills") out.push(row(safeThemeFg("dim", "#   st  name · source"), w))
			else if (this.#kind === "tools") out.push(row(safeThemeFg("dim", "#   st  kind name · platform"), w))
			else out.push(row(safeThemeFg("dim", "#   memory file"), w))

			const n = this.#count()
			this.#tableStartRow = out.length
			this.#tableHitCount = 0
			if (n === 0) {
				out.push(row(safeThemeFg("dim", "Empty."), w))
			}
			for (let i = 0; i < this.#tableRows; i++) {
				const idx = this.#scroll + i
				if (idx >= n) break
				this.#tableHitCount++
				if (this.#kind === "skills") {
					out.push(
						row(
							this.#renderSkillRow(
								this.#skills[idx]!,
								idx === this.#sel,
								idx === this.#hoverIdx,
								inner,
								idx,
							),
							w,
						),
					)
				} else if (this.#kind === "tools") {
					out.push(
						row(
							this.#renderToolRow(
								this.#tools[idx]!,
								idx === this.#sel,
								idx === this.#hoverIdx,
								inner,
								idx,
							),
							w,
						),
					)
				} else {
					out.push(
						row(
							this.#renderMemRow(
								this.#memFiles[idx]!,
								idx === this.#sel,
								idx === this.#hoverIdx,
								inner,
								idx,
							),
							w,
						),
					)
				}
			}

			out.push(divider(w))
			for (const line of this.#detailLines.slice(0, 14)) {
				out.push(row(fit(String(line), inner), w))
			}
			out.push(divider(w))

			const acts = this.#actions()
			this.#actionStartRow = out.length
			this.#actionCount = acts.length
			for (let i = 0; i < acts.length; i++) {
				const a = acts[i]!
				const mark = this.#focus === "actions" && i === this.#actionSel ? safeThemeFg("accent", "›") : " "
				out.push(row(fit(`${mark} ${a.label}${a.desc ? ` (${a.desc})` : ""}`, inner), w))
			}

			const footer =
				this.#kind === "memory"
					? "↑↓/wheel · click row · R reload · Esc/q"
					: "↑↓/wheel · click row · re-tap/e toggle · click action · Esc/q"
			out.push(bottomBorder(w))
			out.push(safeThemeFg("dim", fit(footer, w)))
			return out
		} catch (e) {
			const w = Math.max(40, Math.floor(width) || 80)
			const msg = e instanceof Error ? e.message : String(e)
			return [
				topBorder(w, "Inventory error"),
				row(safeThemeFg("error", msg.slice(0, Math.max(0, w - 6))), w),
				row(safeThemeFg("dim", "Esc to close"), w),
				bottomBorder(w),
			]
		}
	}
}
