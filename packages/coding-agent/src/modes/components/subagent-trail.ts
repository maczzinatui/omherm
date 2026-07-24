/**
 * Subagent trail overlay — live cards for subagent.* / browser.progress events.
 * Fed by InteractiveMode from HermesBrain mapped events (P2 mapper gap).
 */
import type { Component, TUI } from "@oh-my-pi/pi-tui"
import { matchesKey, visibleWidth } from "@oh-my-pi/pi-tui"
import { theme } from "../theme/theme"
import { bottomBorder, divider, fit, row, topBorder } from "./overlay-box"
import { matchesSelectCancel, matchesSelectDown, matchesSelectUp } from "../utils/keybinding-matchers"

export type SubagentTrailEntry = {
	id: string
	goal?: string
	status: "running" | "done" | "tool" | "text"
	preview?: string
	lastTool?: string
	updatedAt: number
}

export class SubagentTrailStore {
	#entries = new Map<string, SubagentTrailEntry>()
	#browserLines: string[] = []
	#listeners = new Set<() => void>()

	subscribe(fn: () => void): () => void {
		this.#listeners.add(fn)
		return () => this.#listeners.delete(fn)
	}

	#emit(): void {
		for (const fn of this.#listeners) {
			try {
				fn()
			} catch {
				/* ignore */
			}
		}
	}

	list(): SubagentTrailEntry[] {
		return [...this.#entries.values()].sort((a, b) => b.updatedAt - a.updatedAt)
	}

	browserLines(): string[] {
		return this.#browserLines.slice(-12)
	}

	clear(): void {
		this.#entries.clear()
		this.#browserLines = []
		this.#emit()
	}

	/** Handle MappedAgentSessionEvent-ish or UiEvent-shaped payloads. */
	ingest(ev: {
		type?: string
		kind?: string
		subagentId?: string
		goal?: string
		preview?: string
		text?: string
		tool?: string
		resultText?: string
		message?: string
	}): void {
		const t = ev.type || ev.kind || ""
		if (t === "browser_progress" || t === "working_status") {
			const msg = ev.message || ev.text
			if (msg && /browser/i.test(msg)) {
				this.#browserLines.push(msg)
				if (this.#browserLines.length > 40) this.#browserLines.shift()
				this.#emit()
			}
			// also parse "subagent: …" working_status
			if (msg?.startsWith("subagent:") || msg?.startsWith("subagent tool:")) {
				const id = "_stream"
				const prev = this.#entries.get(id)
				this.#entries.set(id, {
					id,
					goal: prev?.goal,
					status: msg.startsWith("subagent tool:") ? "tool" : "text",
					preview: msg.replace(/^subagent( tool)?: /, "").slice(0, 160),
					lastTool: prev?.lastTool,
					updatedAt: Date.now(),
				})
				this.#emit()
			}
			return
		}
		if (t === "notice" && (ev as { source?: string }).source === "subagent") {
			// notice messages: `subagent s1 start: …` / `subagent s1 done: …`
			const message = (ev as { message?: string }).message || ""
			const mStart = message.match(/^subagent\s+(\S+)\s+start:\s*(.*)$/i)
			if (mStart) {
				const id = mStart[1]!
				this.#entries.set(id, {
					id,
					goal: mStart[2],
					status: "running",
					preview: mStart[2],
					updatedAt: Date.now(),
				})
				this.#emit()
				return
			}
			const mDone = message.match(/^subagent\s+(\S+)\s+done:\s*(.*)$/i)
			if (mDone) {
				const id = mDone[1]!
				const prev = this.#entries.get(id)
				this.#entries.set(id, {
					id,
					goal: prev?.goal,
					status: "done",
					preview: mDone[2],
					lastTool: prev?.lastTool,
					updatedAt: Date.now(),
				})
				this.#emit()
			}
			return
		}
		// Direct UiEvent kinds
		const id = ev.subagentId
		if (!id) return
		if (t === "subagent_start") {
			this.#entries.set(id, {
				id,
				goal: ev.goal || ev.preview,
				status: "running",
				preview: ev.preview || ev.goal,
				updatedAt: Date.now(),
			})
			this.#emit()
			return
		}
		if (t === "subagent_tool") {
			const prev = this.#entries.get(id)
			this.#entries.set(id, {
				id,
				goal: prev?.goal,
				status: "tool",
				preview: ev.preview,
				lastTool: ev.tool,
				updatedAt: Date.now(),
			})
			this.#emit()
			return
		}
		if (t === "subagent_text") {
			const prev = this.#entries.get(id)
			this.#entries.set(id, {
				id,
				goal: prev?.goal,
				status: "text",
				preview: (ev.text || "").slice(0, 160),
				lastTool: prev?.lastTool,
				updatedAt: Date.now(),
			})
			this.#emit()
			return
		}
		if (t === "subagent_complete") {
			const prev = this.#entries.get(id)
			this.#entries.set(id, {
				id,
				goal: prev?.goal,
				status: "done",
				preview: ev.preview || ev.resultText || prev?.preview,
				lastTool: prev?.lastTool,
				updatedAt: Date.now(),
			})
			this.#emit()
		}
	}
}

export class SubagentTrailComponent implements Component {
	#tui: TUI
	#store: SubagentTrailStore
	#onCancel: () => void
	#sel = 0
	#unsub: (() => void) | null = null

	constructor(tui: TUI, store: SubagentTrailStore, onCancel: () => void) {
		this.#tui = tui
		this.#store = store
		this.#onCancel = onCancel
		this.#tui.enableScopedInputRender?.(this)
		this.#unsub = store.subscribe(() => {
			if (typeof this.#tui.requestComponentRender === "function") {
				this.#tui.requestComponentRender(this)
			} else {
				this.#tui.requestRender()
			}
		})
	}

	dispose(): void {
		this.#unsub?.()
		this.#unsub = null
	}

	handleInput(data: string): void {
		if (matchesSelectCancel(data) || matchesKey(data, "q") || matchesKey(data, "Q")) {
			this.dispose()
			this.#onCancel()
			return
		}
		if (matchesKey(data, "c") || matchesKey(data, "C")) {
			this.#store.clear()
			return
		}
		const n = this.#store.list().length
		if (matchesSelectUp(data)) {
			this.#sel = Math.max(0, this.#sel - 1)
			this.#tui.requestRender()
			return
		}
		if (matchesSelectDown(data)) {
			this.#sel = Math.min(Math.max(0, n - 1), this.#sel + 1)
			this.#tui.requestRender()
		}
	}

	render(width: number): string[] {
		const w = Math.max(40, width)
		const entries = this.#store.list()
		const browser = this.#store.browserLines()
		if (this.#sel >= entries.length) this.#sel = Math.max(0, entries.length - 1)
		const out: string[] = []
		out.push(topBorder(w, `Subagent trail (${entries.length})`))
		if (entries.length === 0) {
			out.push(row(theme.fg("dim", "No subagents this session. Auto-fills on subagent.* events."), w))
		}
		for (let i = 0; i < entries.length && i < 16; i++) {
			const e = entries[i]!
			const mark = i === this.#sel ? theme.fg("accent", "›") : " "
			const st =
				e.status === "running"
					? theme.fg("accent", "run ")
					: e.status === "done"
						? theme.fg("success", "done")
						: e.status === "tool"
							? theme.fg("warning", "tool")
							: theme.fg("dim", "text")
			const id = e.id.slice(0, 12)
			const goal = (e.goal || e.preview || "").slice(0, Math.max(10, w - 30))
			const tool = e.lastTool ? theme.fg("dim", ` [${e.lastTool}]`) : ""
			out.push(row(fit(`${mark} ${st} ${id} ${goal}${tool}`, Math.max(0, w - 4)), w))
			if (i === this.#sel && e.preview && e.preview !== e.goal) {
				out.push(row(theme.fg("dim", fit(`   ${e.preview}`, Math.max(0, w - 4))), w))
			}
		}
		if (browser.length) {
			out.push(divider(w))
			out.push(row(theme.fg("dim", "browser.progress"), w))
			for (const line of browser.slice(-6)) {
				out.push(row(fit(line, Math.max(0, w - 4)), w))
			}
		}
		out.push(bottomBorder(w))
		out.push(theme.fg("dim", fit("↑↓ · c clear · Esc/q close", w)))
		void visibleWidth
		return out
	}
}

const TRAIL_KEY = Symbol.for("meshina.subagentTrailStore")

/** Session-scoped trail store (shared by brain feed + overlay). */
export function getOrCreateSubagentTrailStore(session: unknown): SubagentTrailStore {
	const bag = session as Record<symbol, SubagentTrailStore | undefined>
	let store = bag[TRAIL_KEY]
	if (!store) {
		store = new SubagentTrailStore()
		bag[TRAIL_KEY] = store
	}
	return store
}
