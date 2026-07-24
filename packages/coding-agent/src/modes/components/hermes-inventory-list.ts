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
} from "@meshina/hermes-bridge"
import { theme } from "../theme/theme"
import { bottomBorder, divider, fit, row, topBorder } from "./overlay-box"
import {
	matchesSelectCancel,
	matchesSelectDown,
	matchesSelectPageDown,
	matchesSelectPageUp,
	matchesSelectUp,
} from "../utils/keybinding-matchers"

export type HermesInventoryKind = "skills" | "tools" | "memory"

function pad(s: string, w: number): string {
	if (w <= 0) return ""
	const t = s ?? ""
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

	constructor(tui: TUI, kind: HermesInventoryKind, onCancel: () => void) {
		this.#tui = tui
		this.#kind = kind
		this.#onCancel = onCancel
		try {
			this.#tui.enableScopedInputRender?.(this)
		} catch {
			/* optional */
		}
		void this.reload()
	}

	#paintLocal(): void {
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
				/* swallow — never take down TUI */
			}
		}
	}

	#paintFull(): void {
		try {
			this.#tui.requestRender()
		} catch {
			/* swallow */
		}
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
					throw new Error("skillsPort unavailable — rebuild/relaunch mtui")
				}
				this.#skills = await skillsPort.list()
				if (this.#sel >= this.#skills.length) this.#sel = Math.max(0, this.#skills.length - 1)
			} else if (this.#kind === "tools") {
				if (!toolsPort || typeof toolsPort.list !== "function") {
					throw new Error("toolsPort unavailable — rebuild/relaunch mtui")
				}
				this.#tools = await toolsPort.list()
				if (this.#sel >= this.#tools.length) this.#sel = Math.max(0, this.#tools.length - 1)
			} else {
				if (!memoryPort || typeof memoryPort.read !== "function") {
					throw new Error("memoryPort unavailable — rebuild/relaunch mtui")
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
			this.#paintFull()
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
			const mouse = routeSgrMouseInput?.(data)
			if (mouse) {
				this.#onMouse(mouse)
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

	#onMouse(ev: SgrMouseEvent): void {
		try {
			if (ev.kind === "move" || ev.kind === "drag") {
				if (ev.row >= this.#tableStartRow && ev.row < this.#tableStartRow + this.#tableHitCount) {
					const idx = this.#scroll + (ev.row - this.#tableStartRow)
					if (idx >= 0 && idx < this.#count() && idx !== this.#hoverIdx) {
						this.#hoverIdx = idx
						this.#paintLocal()
					}
				}
				return
			}
			if (ev.kind === "wheel") {
				if (ev.button === "up") this.#sel = Math.max(0, this.#sel - 1)
				else this.#sel = Math.min(Math.max(0, this.#count() - 1), this.#sel + 1)
				this.#clampScroll()
				this.#paintDetailFromList()
				this.#paintLocal()
				return
			}
			if (ev.kind === "down" && ev.button === "left") {
				if (ev.row >= this.#tableStartRow && ev.row < this.#tableStartRow + this.#tableHitCount) {
					const idx = this.#scroll + (ev.row - this.#tableStartRow)
					if (idx >= 0 && idx < this.#count()) {
						this.#sel = idx
						this.#focus = "table"
						this.#paintDetailFromList()
						this.#paintLocal()
					}
					return
				}
				if (this.#actionStartRow >= 0 && this.#actionCount > 0) {
					const aidx = ev.row - this.#actionStartRow
					if (aidx >= 0 && aidx < this.#actionCount) {
						this.#focus = "actions"
						this.#actionSel = aidx
						const a = this.#actions()[aidx]
						if (a) void this.#runAction(a.id)
						this.#paintLocal()
					}
				}
			}
		} catch {
			/* ignore mouse faults */
		}
	}

	#band(line: string, sel: boolean, hover: boolean, w: number): string {
		const fitted = fit(line, w)
		if (sel) return safeThemeBg(fitted)
		if (hover) return safeThemeFg("accent", fitted)
		return fitted
	}

	#renderSkillRow(s: Skill, sel: boolean, hover: boolean, w: number): string {
		const mark = sel ? "›" : hover ? "·" : " "
		const st = s.status === "enabled" ? "on " : s.status === "disabled" ? "off" : " ? "
		const stc =
			s.status === "enabled"
				? safeThemeFg("success", st)
				: s.status === "disabled"
					? safeThemeFg("dim", st)
					: safeThemeFg("warning", st)
		const nameW = Math.max(8, Math.min(32, w - 18))
		const name = pad(s.name, nameW)
		const src = pad(s.source, 8)
		const line = `${mark} ${stc} ${name} ${safeThemeFg("dim", src)}`
		return this.#band(line, sel, hover, w)
	}

	#renderToolRow(t: Tool, sel: boolean, hover: boolean, w: number): string {
		const mark = sel ? "›" : hover ? "·" : " "
		const st = t.status === "enabled" ? "on " : t.status === "disabled" ? "off" : pad(t.status, 3)
		const stc =
			t.status === "enabled"
				? safeThemeFg("success", st)
				: t.status === "disabled"
					? safeThemeFg("dim", st)
					: safeThemeFg("warning", st)
		const kind = pad(t.kind === "mcp-server" ? "mcp" : "bin", 4)
		const nameW = Math.max(8, Math.min(28, w - 22))
		const name = pad(t.name, nameW)
		const plat = pad(String(t.platform), 8)
		const line = `${mark} ${stc} ${safeThemeFg("dim", kind)} ${name} ${safeThemeFg("dim", plat)}`
		return this.#band(line, sel, hover, w)
	}

	#renderMemRow(f: MemoryFile, sel: boolean, hover: boolean, w: number): string {
		const mark = sel ? "›" : hover ? "·" : " "
		const line = `${mark} ${formatMemoryLabel(f)}`
		return this.#band(line, sel, hover, w)
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
			if (this.#kind === "skills") out.push(row(safeThemeFg("dim", "st  name · source"), w))
			else if (this.#kind === "tools") out.push(row(safeThemeFg("dim", "st  kind name · platform"), w))
			else out.push(row(safeThemeFg("dim", "memory file"), w))

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
							this.#renderSkillRow(this.#skills[idx]!, idx === this.#sel, idx === this.#hoverIdx, inner),
							w,
						),
					)
				} else if (this.#kind === "tools") {
					out.push(
						row(
							this.#renderToolRow(this.#tools[idx]!, idx === this.#sel, idx === this.#hoverIdx, inner),
							w,
						),
					)
				} else {
					out.push(
						row(
							this.#renderMemRow(this.#memFiles[idx]!, idx === this.#sel, idx === this.#hoverIdx, inner),
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
					? "↑↓ · R reload · Esc/q close"
					: "↑↓ · e toggle · Tab actions · R reload · Esc/q"
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
