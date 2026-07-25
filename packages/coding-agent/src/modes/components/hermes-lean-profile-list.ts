/**
 * S2 lean-profile settings chrome — mesh lean profiles + on-demand status.
 * Uses createLeanProfilePort (gateway JSON-RPC lean.profile.* when brain live).
 */
import type { Component, TUI } from "@oh-my-pi/pi-tui"
import { matchesKey, routeSgrMouseInput, type SgrMouseEvent, visibleWidth } from "@oh-my-pi/pi-tui"
import {
	createLeanProfilePort,
	createLibraryPort,
	skillsPort,
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

/** Library chrome: menu → browse tools/skills → optional skill detail. */
type LibBrowse = "menu" | "tools" | "skills" | "detail"

type LibItem = { name: string; description: string; category?: string }

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
	// Library browse (CADILLAC: search + open body without leaving coat)
	#libBrowse: LibBrowse = "menu"
	#libQuery = ""
	#libItems: LibItem[] = []
	#libDetailTitle = ""
	#libDetailLines: string[] = []
	#queryEdit = false

	constructor(tui: TUI, kind: HermesLeanChromeKind, onCancel: () => void) {
		this.#tui = tui
		this.#kind = kind
		this.#onCancel = onCancel
		enableOverlayScopedPaint(tui, this)
		void this.reload()
	}

	async reload(): Promise<void> {
		const cold = this.#rows.length === 0 && this.#libItems.length === 0
		this.#loading = cold
		this.#error = ""
		if (cold) paintOverlayFull(this.#tui)
		try {
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
				const ai = this.#rows.findIndex((r) => r.active)
				if (ai >= 0) this.#sel = ai
			} else if (this.#libBrowse === "tools" || this.#libBrowse === "skills") {
				await this.#loadLibBrowse(false)
			} else if (this.#libBrowse === "detail") {
				/* keep detail */
			} else {
				try {
					this.#state = await port.get()
				} catch {
					this.#state = null
				}
				try {
					// Prefer batched snapshot (one RPC) when gateway supports it
					const snap = await lib.snapshot({ include_metrics: false })
					const tc = Number(snap.tools_catalog_count ?? 0)
					const sc = Number(snap.skills_catalog_count ?? 0)
					if (tc > 0 || sc > 0) {
						this.#libTools = tc
						this.#libSkills = sc
						const ao = Array.isArray(snap.always_on_tools)
							? (snap.always_on_tools as string[]).length
							: 0
						this.#banner = snap.on_demand
							? `on-demand · always-on tools=${ao} · catalogs t=${tc} s=${sc}`
							: `full index · catalogs t=${tc} s=${sc}`
					} else {
						const t = await lib.tools()
						const s = await lib.skills()
						this.#libTools = typeof t?.count === "number" ? t.count : (t?.tools?.length ?? 0)
						this.#libSkills = typeof s?.count === "number" ? s.count : (s?.skills?.length ?? 0)
						this.#libPath = t?.path || s?.path || ""
					}
				} catch (e) {
					try {
						const t = await lib.tools()
						const s = await lib.skills()
						this.#libTools = typeof t?.count === "number" ? t.count : (t?.tools?.length ?? 0)
						this.#libSkills = typeof s?.count === "number" ? s.count : (s?.skills?.length ?? 0)
						this.#libPath = t?.path || s?.path || ""
					} catch (e2) {
						this.#libTools = 0
						this.#libSkills = 0
						this.#error = e2 instanceof Error ? e2.message : String(e2)
					}
				}
				this.#rows = [
					{
						name: "tools-catalog",
						meta: {
							description: `${this.#libTools} tools · Enter browse/search`,
							toolsets: [],
						},
						active: false,
					},
					{
						name: "skills-catalog",
						meta: {
							description: `${this.#libSkills} skills · Enter browse · / query`,
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
			if (this.#libBrowse === "menu" || this.#kind === "lean-profile") {
				if (this.#sel >= this.#rows.length) this.#sel = Math.max(0, this.#rows.length - 1)
			} else if (this.#libBrowse === "tools" || this.#libBrowse === "skills") {
				if (this.#sel >= this.#libItems.length) this.#sel = Math.max(0, this.#libItems.length - 1)
			}
		} catch (e) {
			this.#error = e instanceof Error ? e.message : String(e)
			this.#rows = []
		}
		this.#loading = false
		paintOverlayReload(this.#tui, this, false)
	}

	async #loadLibBrowse(resetSel: boolean): Promise<void> {
		const lib = createLibraryPort()
		const q = this.#libQuery.trim()
		if (this.#libBrowse === "tools") {
			const t = await lib.tools()
			let items = (t.tools || []).map((x) => ({
				name: String(x.name || ""),
				description: String(x.description || "").slice(0, 120),
			}))
			if (q) {
				const ql = q.toLowerCase()
				items = items.filter(
					(i) => i.name.toLowerCase().includes(ql) || i.description.toLowerCase().includes(ql),
				)
			}
			items.sort((a, b) => a.name.localeCompare(b.name))
			this.#libItems = items
			this.#libTools = t.count
			this.#libPath = t.path || this.#libPath
			this.#banner = q ? `tools filter “${q}” · ${items.length} hits` : `tools library · ${items.length}`
		} else if (this.#libBrowse === "skills") {
			const s = await lib.skills({ query: q || undefined })
			const raw = s.skills || []
			this.#libItems = raw.map((sk) => ({
				name: String(sk.name || sk.id || ""),
				description: String(sk.description || sk.short || "").slice(0, 120),
				category: sk.category != null ? String(sk.category) : undefined,
			}))
			this.#libSkills = s.count
			this.#libPath = s.path || this.#libPath
			this.#banner = q
				? `skills “${q}” · ${this.#libItems.length} hits (library.skills)`
				: `skills library · ${this.#libItems.length}`
		}
		if (resetSel) {
			this.#sel = 0
			this.#scroll = 0
		}
	}

	invalidate(): void {
		paintOverlayLocal(this.#tui, this)
	}

	#listLen(): number {
		if (this.#kind === "library" && (this.#libBrowse === "tools" || this.#libBrowse === "skills")) {
			return this.#libItems.length
		}
		if (this.#kind === "library" && this.#libBrowse === "detail") return 0
		return this.#rows.length
	}

	handleInput(data: string): void {
		try {
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
				if (this.#queryEdit) {
					this.#queryEdit = false
					this.invalidate()
					return
				}
				if (this.#kind === "library" && this.#libBrowse === "detail") {
					this.#libBrowse = "skills"
					this.#libDetailLines = []
					void this.reload()
					return
				}
				if (this.#kind === "library" && (this.#libBrowse === "tools" || this.#libBrowse === "skills")) {
					this.#libBrowse = "menu"
					this.#libQuery = ""
					this.#libItems = []
					this.#sel = 0
					this.#scroll = 0
					void this.reload()
					return
				}
				this.#onCancel()
				return
			}
			if (this.#loading) return

			// Library query edit: type to filter, Enter applies, Esc cancels edit
			if (this.#kind === "library" && this.#queryEdit) {
				if (matchesKey(data, "return") || data === "\n") {
					this.#queryEdit = false
					void this.#loadLibBrowse(true).then(() => this.invalidate())
					return
				}
				if (data === "\x7f" || data === "\b" || matchesKey(data, "backspace")) {
					this.#libQuery = this.#libQuery.slice(0, -1)
					this.invalidate()
					return
				}
				if (data.length === 1 && data >= " " && data !== "/") {
					this.#libQuery += data
					this.invalidate()
					return
				}
				return
			}

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

			// Start filter when browsing tools/skills
			if (
				this.#kind === "library" &&
				(this.#libBrowse === "tools" || this.#libBrowse === "skills") &&
				(data === "/" || data === "f")
			) {
				this.#queryEdit = true
				this.#banner = `filter: ${this.#libQuery}_  (type · Enter apply · Esc cancel)`
				this.invalidate()
				return
			}

			const n = Math.max(0, this.#listLen() - 1)
			if (matchesSelectDown(data)) {
				this.#sel = Math.min(n, this.#sel + 1)
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
				this.#sel = Math.min(n, this.#sel + 8)
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
		// library
		if (this.#libBrowse === "detail") {
			this.#libBrowse = "skills"
			this.#libDetailLines = []
			await this.reload()
			return
		}
		if (this.#libBrowse === "tools") {
			const it = this.#libItems[this.#sel]
			this.#banner = it
				? `tool ${it.name} — use tool_search / enable in /tools inventory`
				: "empty tools list"
			this.invalidate()
			return
		}
		if (this.#libBrowse === "skills") {
			const it = this.#libItems[this.#sel]
			if (!it?.name) return
			this.#banner = `loading skill_view ${it.name}…`
			this.invalidate()
			try {
				const text = await skillsPort.inspect(it.name)
				this.#libDetailTitle = it.name
				this.#libDetailLines = (text || "(empty)").split(/\r?\n/).slice(0, 80)
				this.#libBrowse = "detail"
				this.#scroll = 0
				this.#banner = `skill body · Esc back · ${it.name}`
			} catch (e) {
				this.#banner = e instanceof Error ? e.message : String(e)
			}
			this.invalidate()
			return
		}
		// menu
		const row = this.#rows[this.#sel]
		if (row?.name === "refresh") {
			await this.#refreshLibrary()
			return
		}
		if (row?.name === "tools-catalog") {
			this.#libBrowse = "tools"
			this.#libQuery = ""
			this.#sel = 0
			this.#scroll = 0
			this.#loading = true
			this.invalidate()
			await this.#loadLibBrowse(true)
			this.#loading = false
			this.invalidate()
			return
		}
		if (row?.name === "skills-catalog") {
			this.#libBrowse = "skills"
			this.#libQuery = ""
			this.#sel = 0
			this.#scroll = 0
			this.#loading = true
			this.invalidate()
			await this.#loadLibBrowse(true)
			this.#loading = false
			this.invalidate()
			return
		}
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

			const listN = this.#listLen()

			if (ev.motion) {
				if (ev.row >= this.#tableStart && ev.row < this.#tableStart + this.#tableHit) {
					const idx = this.#scroll + (ev.row - this.#tableStart)
					if (idx >= 0 && idx < listN && idx !== this.#hoverIdx) {
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
				if (this.#libBrowse === "detail") {
					this.#scroll = Math.max(0, this.#scroll + ev.wheel)
					this.invalidate()
					return true
				}
				if (listN === 0) return true
				this.#sel = Math.max(0, Math.min(listN - 1, this.#sel + ev.wheel))
				this.#ensureScroll()
				this.invalidate()
				return true
			}

			if (ev.leftClick) {
				if (ev.row >= this.#tableStart && ev.row < this.#tableStart + this.#tableHit) {
					const idx = this.#scroll + (ev.row - this.#tableStart)
					if (idx >= 0 && idx < listN) {
						const reTap = idx === this.#sel
						this.#sel = idx
						this.#hoverIdx = -1
						this.#ensureScroll()
						this.invalidate()
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
		const n = this.#listLen()
		if (this.#sel < this.#scroll) this.#scroll = this.#sel
		if (this.#sel >= this.#scroll + vis) this.#scroll = this.#sel - vis + 1
		this.#scroll = Math.max(0, Math.min(this.#scroll, Math.max(0, n - vis)))
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

	#paintSelRow(line: string, sel: boolean, hover: boolean, w: number): string {
		const body = fit(line, w - 4)
		if (sel) {
			try {
				return theme.bg("selectedBg", theme.bold(theme.fg("accent", body)))
			} catch {
				return safeBg(body)
			}
		}
		if (hover) {
			try {
				return theme.bg("selectedBg", theme.fg("accent", body))
			} catch {
				return safeFg("accent", body)
			}
		}
		return body
	}

	#renderInner(w: number): string[] {
		const title =
			this.#kind === "lean-profile"
				? "Mesh lean profile (S2)"
				: this.#libBrowse === "tools"
					? "Library · tools browse"
					: this.#libBrowse === "skills"
						? "Library · skills browse"
						: this.#libBrowse === "detail"
							? `Library · ${this.#libDetailTitle || "skill"}`
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
		if (this.#banner || this.#queryEdit) {
			const b = this.#queryEdit
				? `filter: ${this.#libQuery}_  (Enter apply · Esc cancel edit)`
				: this.#banner
			out.push(row(safeFg("accent", fit(b, w - 4)), w))
		}
		if (this.#state && this.#libBrowse === "menu") {
			const od = this.#state.on_demand ? "on-demand ON" : "on-demand off"
			const sc = this.#state.on_demand_scope || "?"
			const act = this.#state.active || "(default)"
			out.push(row(safeFg("muted", fit(`active=${act} · ${od} · scope=${sc}`, w - 4)), w))
		}
		if (this.#kind === "library" && this.#libPath && this.#libBrowse !== "detail") {
			out.push(row(safeFg("muted", fit(this.#libPath, w - 4)), w))
		}
		out.push(divider(w))

		// Skill detail pager
		if (this.#kind === "library" && this.#libBrowse === "detail") {
			const bodyH = Math.max(8, Math.min(22, (process.stdout.rows || 24) - 10))
			this.#tableStart = out.length
			this.#tableHit = bodyH
			const end = Math.min(this.#libDetailLines.length, this.#scroll + bodyH)
			for (let i = this.#scroll; i < end; i++) {
				out.push(row(fit(this.#libDetailLines[i] ?? "", w - 4), w))
			}
			if (!this.#libDetailLines.length) {
				out.push(row(safeFg("muted", "(empty skill body)"), w))
			}
			out.push(divider(w))
			out.push(row(safeFg("muted", "wheel/↑↓ scroll · Esc back to skills · Enter back"), w))
			out.push(bottomBorder(w))
			return out
		}

		const browsing = this.#kind === "library" && (this.#libBrowse === "tools" || this.#libBrowse === "skills")
		const header = browsing
			? `${pad(" ", 2)}${pad("NAME", 24)} ${pad("DETAIL", 40)}`
			: this.#kind === "lean-profile"
				? `${pad(" ", 2)}${pad("PROFILE", 16)} ${pad("TOOLSETS", 28)} ${pad("DESC", 24)}`
				: `${pad(" ", 2)}${pad("ENTRY", 18)} ${pad("DETAIL", 40)}`
		out.push(row(safeFg("muted", fit(header, w - 4)), w))
		out.push(divider(w))

		const listN = browsing ? this.#libItems.length : this.#rows.length
		const bodyH = Math.max(6, Math.min(16, listN || 1))
		this.#tableStart = out.length
		this.#tableHit = bodyH
		const end = Math.min(listN, this.#scroll + bodyH)
		for (let i = this.#scroll; i < end; i++) {
			const sel = i === this.#sel
			const hover = !sel && i === this.#hoverIdx
			let line: string
			if (browsing) {
				const it = this.#libItems[i]!
				const mark = i === this.#sel ? "›" : i === this.#hoverIdx ? "·" : " "
				const cat = it.category ? `[${it.category}] ` : ""
				line = `${mark} ${pad(it.name, 24)} ${pad(cat + (it.description || ""), 40)}`
			} else {
				const r = this.#rows[i]!
				const mark = r.active ? "●" : i === this.#sel ? "›" : i === this.#hoverIdx ? "·" : " "
				if (this.#kind === "lean-profile") {
					const ts = (r.meta.toolsets || []).join(",")
					line = `${mark} ${pad(r.name, 16)} ${pad(ts, 28)} ${pad(r.meta.description || "", 24)}`
				} else {
					line = `${mark} ${pad(r.name, 18)} ${pad(r.meta.description || "", 40)}`
				}
			}
			out.push(row(this.#paintSelRow(line, sel, hover, w), w))
		}
		if (!listN) {
			out.push(
				row(
					safeFg(
						"muted",
						browsing ? "No matches · / to filter · Esc menu" : "No profiles (gateway lean.profile.get?)",
					),
					w,
				),
			)
		}
		out.push(divider(w))
		const help =
			this.#kind === "lean-profile"
				? "↑↓/wheel · click/re-tap set · r reload · Esc"
				: browsing
					? "↑↓/wheel · / filter · Enter open · r reload · Esc menu"
					: "↑↓/wheel · Enter browse tools/skills · r refresh · Esc"
		out.push(row(safeFg("muted", fit(help, w - 4)), w))
		if (!browsing && this.#kind === "lean-profile") {
			const cur = this.#rows[this.#sel]
			if (cur) {
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
		}
		if (browsing && this.#libItems[this.#sel]) {
			const it = this.#libItems[this.#sel]!
			out.push(divider(w))
			out.push(row(safeFg("accent", fit(it.name, w - 4)), w))
			out.push(row(fit(it.description || "", w - 4), w))
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
