/**
 * S2 lean-profile settings chrome — mesh lean profiles + on-demand status.
 * Uses createLeanProfilePort (gateway JSON-RPC lean.profile.* when brain live).
 */
import type { Component, TUI } from "@oh-my-pi/pi-tui"
import { matchesKey, routeSgrMouseInput, type SgrMouseEvent, visibleWidth } from "@oh-my-pi/pi-tui"
import {
	createLeanProfilePort,
	createLibraryPort,
	type LeanProfileMeta,
	type LeanProfileState,
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

function pad(s: string, w: number): string {
	if (w <= 0) return ""
	const t = s ?? ""
	const vw = visibleWidth(t)
	if (vw === w) return t
	if (vw < w) return t + " ".repeat(w - vw)
	let out = ""
	let used = 0
	for (const ch of t) {
		const cw = visibleWidth(ch)
		if (used + cw > w - 1) break
		out += ch
		used += cw
	}
	return out + "…"
}

type Row = { name: string; meta: LeanProfileMeta; active: boolean }

export type HermesLeanChromeKind = "lean-profile" | "library"

export class HermesLeanProfileListComponent implements Component {
	#tui: TUI
	#kind: HermesLeanChromeKind
	#onCancel: () => void
	#loading = true
	#error = ""
	#banner = ""
	#sel = 0
	#scroll = 0
	#rows: Row[] = []
	#state: LeanProfileState | null = null
	#libTools = 0
	#libSkills = 0
	#libPath = ""
	#confirm = false
	#tableStart = 0
	#tableHit = 0
	#hoverIdx = -1
	#pendingHover = -2
	#hoverRaf: ReturnType<typeof setTimeout> | null = null

	constructor(tui: TUI, kind: HermesLeanChromeKind, onCancel: () => void) {
		this.#tui = tui
		this.#kind = kind
		this.#onCancel = onCancel
		enableOverlayScopedPaint(tui, this)
		void this.reload()
	}

	async reload(): Promise<void> {
		const cold = this.#rows.length === 0
		this.#loading = cold
		this.#error = ""
		if (cold) paintOverlayFull(this.#tui)
		try {
			// Prefer gateway via bound brain if available — ports work without gw too
			const port = createLeanProfilePort()
			const lib = createLibraryPort()
			if (this.#kind === "lean-profile") {
				this.#state = await port.get()
				const profiles =
					this.#state?.profiles && typeof this.#state.profiles === "object"
						? this.#state.profiles
						: {}
				const names = Object.keys(profiles).sort()
				this.#rows = names.map((name) => ({
					name,
					meta: profiles[name] ?? { description: "", toolsets: [] },
					active: this.#state!.active === name,
				}))
				// Prefer active row selected
				const ai = this.#rows.findIndex((r) => r.active)
				if (ai >= 0) this.#sel = ai
			} else {
				try {
					this.#state = await port.get()
				} catch {
					this.#state = null
				}
				try {
					const t = await lib.tools()
					const s = await lib.skills()
					this.#libTools = typeof t?.count === "number" ? t.count : (t?.tools?.length ?? 0)
					this.#libSkills = typeof s?.count === "number" ? s.count : (s?.skills?.length ?? 0)
					this.#libPath = t?.path || s?.path || ""
				} catch (e) {
					this.#libTools = 0
					this.#libSkills = 0
					this.#error = e instanceof Error ? e.message : String(e)
				}
				this.#rows = [
					{
						name: "tools-catalog",
						meta: {
							description: `${this.#libTools} tools in library (out of context)`,
							toolsets: [],
						},
						active: false,
					},
					{
						name: "skills-catalog",
						meta: {
							description: `${this.#libSkills} skills in library (out of context)`,
							toolsets: [],
						},
						active: false,
					},
					{
						name: "refresh",
						meta: {
							description: "library.refresh — rebuild both catalogs",
							toolsets: [],
						},
						active: false,
					},
				]
			}
			if (this.#sel >= this.#rows.length) this.#sel = Math.max(0, this.#rows.length - 1)
		} catch (e) {
			this.#error = e instanceof Error ? e.message : String(e)
			this.#rows = []
		}
		this.#loading = false
		paintOverlayReload(this.#tui, this, false)
	}

	invalidate(): void {
		paintOverlayLocal(this.#tui, this)
	}

	handleInput(data: string): void {
		try {
			// CADILLAC: fullscreen overlays own SGR mouse — handler required (pi-tui).
			// Finger taps = leftClick; wheel = scroll selection (mobile/glass).
			if (routeSgrMouseInput(data, (event) => this.#onMouse(event))) {
				return
			}
			if (matchesSelectCancel(data) || matchesKey(data, "escape")) {
				if (this.#confirm) {
					this.#confirm = false
					this.#banner = ""
					this.invalidate()
					return
				}
				this.#onCancel()
				return
			}
			if (this.#loading) return

			if (this.#confirm && this.#kind === "lean-profile") {
				if (data === "y" || data === "Y" || matchesKey(data, "return")) {
					void this.#applyProfile()
					return
				}
				if (data === "n" || data === "N") {
					this.#confirm = false
					this.#banner = "cancelled"
					this.invalidate()
					return
				}
			}

			if (matchesSelectDown(data)) {
				this.#sel = Math.min(this.#rows.length - 1, this.#sel + 1)
				this.#ensureScroll()
				this.invalidate()
				return
			}
			if (matchesSelectUp(data)) {
				this.#sel = Math.max(0, this.#sel - 1)
				this.#ensureScroll()
				this.invalidate()
				return
			}
			if (matchesSelectPageDown(data)) {
				this.#sel = Math.min(this.#rows.length - 1, this.#sel + 8)
				this.#ensureScroll()
				this.invalidate()
				return
			}
			if (matchesSelectPageUp(data)) {
				this.#sel = Math.max(0, this.#sel - 8)
				this.#ensureScroll()
				this.invalidate()
				return
			}
			if (data === "r" || data === "R") {
				void this.reload()
				return
			}
			if (matchesKey(data, "return") || data === " ") {
				void this.#activateSelected()
			}
		} catch (e) {
			this.#banner = e instanceof Error ? e.message : String(e)
			this.invalidate()
		}
	}

	/** Enter / re-tap / click-activate for current selection. */
	async #activateSelected(): Promise<void> {
		if (this.#kind === "lean-profile") {
			const row = this.#rows[this.#sel]
			if (!row) return
			if (row.active) {
				this.#banner = `already active: ${row.name}`
				this.invalidate()
				return
			}
			this.#confirm = true
			this.#banner = `Set lean profile to ${row.name}? [y/N] · tap again / y`
			this.invalidate()
			return
		}
		const row = this.#rows[this.#sel]
		if (row?.name === "refresh") {
			await this.#refreshLibrary()
			return
		}
		this.#banner = "Use /skills or /tools for inventory; tap refresh to rebuild catalogs"
		this.invalidate()
	}

	/**
	 * pi-tui SgrMouseEvent fields only (motion / wheel / leftClick).
	 * Wrong kind/button strings = silent dead mouse (inventory bug 2026-07-25).
	 */
	#onMouse(ev: SgrMouseEvent): boolean {
		try {
			if (ev.release) return true
			if (this.#loading) return true

			// Confirm banner: y/n as taps on... we only have keyboard for y/n;
			// leftClick outside table cancels; leftClick on selected confirms.
			if (this.#confirm && this.#kind === "lean-profile") {
				if (ev.leftClick) {
					if (
						ev.row >= this.#tableStart &&
						ev.row < this.#tableStart + this.#tableHit
					) {
						const idx = this.#scroll + (ev.row - this.#tableStart)
						if (idx === this.#sel) {
							void this.#applyProfile()
							return true
						}
						// tap other row → cancel confirm, reselect
						this.#confirm = false
						if (idx >= 0 && idx < this.#rows.length) this.#sel = idx
						this.#banner = ""
						this.#ensureScroll()
						this.invalidate()
						return true
					}
					this.#confirm = false
					this.#banner = "cancelled"
					this.invalidate()
				}
				return true
			}

			if (ev.motion) {
				if (ev.row >= this.#tableStart && ev.row < this.#tableStart + this.#tableHit) {
					const idx = this.#scroll + (ev.row - this.#tableStart)
					if (idx >= 0 && idx < this.#rows.length && idx !== this.#hoverIdx) {
						this.#pendingHover = idx
						if (this.#hoverRaf == null) {
							this.#hoverRaf = setTimeout(() => {
								this.#hoverRaf = null
								if (this.#pendingHover >= 0 && this.#pendingHover !== this.#hoverIdx) {
									this.#hoverIdx = this.#pendingHover
									this.invalidate()
								}
							}, 16)
						}
					}
				} else if (this.#hoverIdx !== -1) {
					this.#hoverIdx = -1
					this.#pendingHover = -2
					if (this.#hoverRaf != null) {
						clearTimeout(this.#hoverRaf)
						this.#hoverRaf = null
					}
					this.invalidate()
				}
				return true
			}

			if (ev.wheel != null) {
				this.#hoverIdx = -1
				const n = this.#rows.length
				if (n === 0) return true
				this.#sel = Math.max(0, Math.min(n - 1, this.#sel + ev.wheel))
				this.#ensureScroll()
				this.invalidate()
				return true
			}

			if (ev.leftClick) {
				if (ev.row >= this.#tableStart && ev.row < this.#tableStart + this.#tableHit) {
					const idx = this.#scroll + (ev.row - this.#tableStart)
					if (idx >= 0 && idx < this.#rows.length) {
						const reTap = idx === this.#sel
						this.#sel = idx
						this.#hoverIdx = -1
						this.#ensureScroll()
						this.invalidate()
						// Finger: first tap select, second tap activate (set profile / refresh)
						if (reTap) void this.#activateSelected()
					}
					return true
				}
			}
		} catch {
			/* never crash coat on mouse */
		}
		return true
	}

	async #applyProfile(): Promise<void> {
		const row = this.#rows[this.#sel]
		if (!row) return
		this.#confirm = false
		this.#banner = `setting ${row.name}…`
		this.invalidate()
		try {
			// Gateway rebound on brain install via bindSkillsToolsGateway
			const port = createLeanProfilePort()
			await port.set(row.name, { persist: true })
			this.#banner = `active lean profile → ${row.name}`
			await this.reload()
		} catch (e) {
			this.#banner = e instanceof Error ? e.message : String(e)
			this.invalidate()
		}
	}

	async #refreshLibrary(): Promise<void> {
		this.#banner = "refreshing catalogs…"
		this.invalidate()
		try {
			const lib = createLibraryPort()
			await lib.refresh()
			this.#banner = "library refreshed"
			await this.reload()
		} catch (e) {
			this.#banner = e instanceof Error ? e.message : String(e)
			this.invalidate()
		}
	}

	#ensureScroll(): void {
		const vis = Math.max(4, this.#tableHit)
		if (this.#sel < this.#scroll) this.#scroll = this.#sel
		if (this.#sel >= this.#scroll + vis) this.#scroll = this.#sel - vis + 1
	}

	render(w: number): string[] {
		try {
			return this.#renderInner(w)
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			return [
				topBorder("Lean chrome error", w),
				row(fit(msg, Math.max(8, w - 4)), w),
				bottomBorder(w),
			]
		}
	}

	#renderInner(w: number): string[] {
		const title =
			this.#kind === "lean-profile"
				? "Mesh lean profile (S2)"
				: "On-demand library (tools + skills)"
		const out: string[] = []
		out.push(topBorder(title, w))
		if (this.#loading) {
			out.push(row(safeFg("muted", "Loading…"), w))
			out.push(bottomBorder(w))
			return out
		}
		if (this.#error) {
			out.push(row(safeFg("warning", fit(this.#error, w - 4)), w))
		}
		if (this.#banner) {
			out.push(row(safeFg("accent", fit(this.#banner, w - 4)), w))
		}
		if (this.#state) {
			const od = this.#state.on_demand ? "on-demand ON" : "on-demand off"
			const sc = this.#state.on_demand_scope || "?"
			const act = this.#state.active || "(default)"
			out.push(row(safeFg("muted", fit(`active=${act} · ${od} · scope=${sc}`, w - 4)), w))
		}
		if (this.#kind === "library" && this.#libPath) {
			out.push(row(safeFg("muted", fit(this.#libPath, w - 4)), w))
		}
		out.push(divider(w))
		const header =
			this.#kind === "lean-profile"
				? `${pad(" ", 2)}${pad("PROFILE", 16)} ${pad("TOOLSETS", 28)} ${pad("DESC", 24)}`
				: `${pad(" ", 2)}${pad("ENTRY", 18)} ${pad("DETAIL", 40)}`
		out.push(row(safeFg("muted", fit(header, w - 4)), w))
		out.push(divider(w))

		const bodyH = Math.max(6, Math.min(16, this.#rows.length || 1))
		this.#tableStart = out.length
		this.#tableHit = bodyH
		const end = Math.min(this.#rows.length, this.#scroll + bodyH)
		for (let i = this.#scroll; i < end; i++) {
			const r = this.#rows[i]!
			const mark = r.active ? "●" : i === this.#sel ? "›" : i === this.#hoverIdx ? "·" : " "
			const sel = i === this.#sel
			const hover = !sel && i === this.#hoverIdx
			let line: string
			if (this.#kind === "lean-profile") {
				const ts = (r.meta.toolsets || []).join(",")
				line = `${mark} ${pad(r.name, 16)} ${pad(ts, 28)} ${pad(r.meta.description || "", 24)}`
			} else {
				line = `${mark} ${pad(r.name, 18)} ${pad(r.meta.description || "", 40)}`
			}
			// Full-width selectedBg on plain text (no nested SGR mid-line — that
			// only highlighted the caret/index in some terminals).
			const body = fit(line, w - 4)
			let painted = body
			if (sel) {
				try {
					const accent = theme.bold(theme.fg("accent", body))
					painted = theme.bg("selectedBg", accent)
				} catch {
					painted = safeBg(body)
				}
			} else if (hover) {
				try {
					painted = theme.bg("selectedBg", theme.fg("accent", body))
				} catch {
					painted = safeFg("accent", body)
				}
			}
			out.push(row(painted, w))
		}
		if (!this.#rows.length) {
			out.push(row(safeFg("muted", "No profiles (gateway lean.profile.get?)"), w))
		}
		out.push(divider(w))
		const help =
			this.#kind === "lean-profile"
				? "↑↓/wheel · click/re-tap set · r reload · Esc"
				: "↑↓/wheel · click/re-tap refresh · r reload · Esc"
		out.push(row(safeFg("muted", fit(help, w - 4)), w))
		// detail
		const cur = this.#rows[this.#sel]
		if (cur && this.#kind === "lean-profile") {
			out.push(divider(w))
			out.push(row(safeFg("accent", fit(cur.name, w - 4)), w))
			out.push(row(fit(cur.meta.description || "", w - 4), w))
			out.push(
				row(
					safeFg(
						"muted",
						fit(
							`toolsets: ${(cur.meta.toolsets || []).join(", ") || "—"} · skills=${cur.meta.skills ?? "?"} · memory=${cur.meta.memory ?? "?"}`,
							w - 4,
						),
					),
					w,
				),
			)
		}
		out.push(bottomBorder(w))
		return out
	}
}

function safeFg(color: "accent" | "dim" | "error" | "success" | "warning" | "text" | "muted", text: string): string {
	try {
		if (typeof theme?.fg !== "function") return text
		return theme.fg(color as never, text)
	} catch {
		return text
	}
}

function safeBg(text: string): string {
	try {
		if (typeof theme?.bg !== "function") return text
		return theme.bg("selectedBg", text)
	} catch {
		return text
	}
}
