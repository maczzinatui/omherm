/**
 * S2 lean-profile settings chrome — mesh lean profiles + on-demand status.
 * Uses createLeanProfilePort (gateway JSON-RPC lean.profile.* when brain live).
 */
import type { Component, TUI } from "@oh-my-pi/pi-tui"
import { matchesKey, visibleWidth } from "@oh-my-pi/pi-tui"
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

	constructor(tui: TUI, kind: HermesLeanChromeKind, onCancel: () => void) {
		this.#tui = tui
		this.#kind = kind
		this.#onCancel = onCancel
		enableOverlayScopedPaint(tui)
		void this.reload()
	}

	async reload(): Promise<void> {
		this.#loading = true
		this.#error = ""
		paintOverlayReload(this.#tui, this, false)
		try {
			// Prefer gateway via bound brain if available — ports work without gw too
			const port = createLeanProfilePort()
			const lib = createLibraryPort()
			if (this.#kind === "lean-profile") {
				this.#state = await port.get()
				const names = Object.keys(this.#state.profiles || {}).sort()
				this.#rows = names.map((name) => ({
					name,
					meta: this.#state!.profiles[name]!,
					active: this.#state!.active === name,
				}))
				// Prefer active row selected
				const ai = this.#rows.findIndex((r) => r.active)
				if (ai >= 0) this.#sel = ai
			} else {
				this.#state = await port.get()
				try {
					const t = await lib.tools()
					const s = await lib.skills()
					this.#libTools = t.count
					this.#libSkills = s.count
					this.#libPath = t.path || s.path || ""
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
		paintOverlayFull(this.#tui, this)
	}

	invalidate(): void {
		paintOverlayLocal(this.#tui, this)
	}

	handleInput(data: string): void {
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
			if (this.#kind === "lean-profile") {
				const row = this.#rows[this.#sel]
				if (!row) return
				if (row.active) {
					this.#banner = `already active: ${row.name}`
					this.invalidate()
					return
				}
				this.#confirm = true
				this.#banner = `Set lean profile to ${row.name}? [y/N]`
				this.invalidate()
				return
			}
			// library
			const row = this.#rows[this.#sel]
			if (row?.name === "refresh") {
				void this.#refreshLibrary()
				return
			}
			this.#banner = "Use /skills or /tools for inventory; Enter on refresh rebuilds catalogs"
			this.invalidate()
		}
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
		const title =
			this.#kind === "lean-profile"
				? "Mesh lean profile (S2)"
				: "On-demand library (tools + skills)"
		const out: string[] = []
		out.push(topBorder(title, w))
		if (this.#loading) {
			out.push(row(theme.fg("muted", "Loading…"), w))
			out.push(bottomBorder(w))
			return out
		}
		if (this.#error) {
			out.push(row(theme.fg("warning", fit(this.#error, w - 4)), w))
		}
		if (this.#banner) {
			out.push(row(theme.fg("accent", fit(this.#banner, w - 4)), w))
		}
		if (this.#state) {
			const od = this.#state.on_demand ? "on-demand ON" : "on-demand off"
			const sc = this.#state.on_demand_scope || "?"
			const act = this.#state.active || "(default)"
			out.push(
				row(
					theme.fg(
						"muted",
						fit(`active=${act} · ${od} · scope=${sc}`, w - 4),
					),
					w,
				),
			)
		}
		if (this.#kind === "library" && this.#libPath) {
			out.push(row(theme.fg("muted", fit(this.#libPath, w - 4)), w))
		}
		out.push(divider(w))
		const header =
			this.#kind === "lean-profile"
				? `${pad(" ", 2)}${pad("PROFILE", 16)} ${pad("TOOLSETS", 28)} ${pad("DESC", 24)}`
				: `${pad(" ", 2)}${pad("ENTRY", 18)} ${pad("DETAIL", 40)}`
		out.push(row(theme.fg("muted", fit(header, w - 4)), w))
		out.push(divider(w))

		const bodyH = Math.max(6, Math.min(16, this.#rows.length || 1))
		this.#tableStart = out.length
		this.#tableHit = bodyH
		const end = Math.min(this.#rows.length, this.#scroll + bodyH)
		for (let i = this.#scroll; i < end; i++) {
			const r = this.#rows[i]!
			const mark = r.active ? "●" : i === this.#sel ? "›" : " "
			const sel = i === this.#sel
			let line: string
			if (this.#kind === "lean-profile") {
				const ts = (r.meta.toolsets || []).join(",")
				line = `${mark} ${pad(r.name, 16)} ${pad(ts, 28)} ${pad(r.meta.description || "", 24)}`
			} else {
				line = `${mark} ${pad(r.name, 18)} ${pad(r.meta.description || "", 40)}`
			}
			const painted = sel ? theme.bg("selected", fit(line, w - 4)) : fit(line, w - 4)
			out.push(row(painted, w))
		}
		if (!this.#rows.length) {
			out.push(row(theme.fg("muted", "No profiles (gateway lean.profile.get?)"), w))
		}
		out.push(divider(w))
		const help =
			this.#kind === "lean-profile"
				? "↑↓ select · Enter set · r reload · Esc close"
				: "↑↓ · Enter refresh · r reload · Esc close"
		out.push(row(theme.fg("muted", fit(help, w - 4)), w))
		// detail
		const cur = this.#rows[this.#sel]
		if (cur && this.#kind === "lean-profile") {
			out.push(divider(w))
			out.push(row(theme.fg("accent", fit(cur.name, w - 4)), w))
			out.push(row(fit(cur.meta.description || "", w - 4), w))
			out.push(
				row(
					theme.fg(
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
