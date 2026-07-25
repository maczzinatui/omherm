/**
 * Simple fullscreen text pager for slash.exec / long CLI dumps.
 * Never throw out of render/input.
 * CADILLAC: SGR wheel scrolls the body (same as ↑↓ / PgUp/PgDn).
 */
import type { Component, TUI } from "@oh-my-pi/pi-tui"
import { matchesKey, routeSgrMouseInput } from "@oh-my-pi/pi-tui"
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

function safeFg(color: "accent" | "dim" | "error" | "muted", text: string): string {
	try {
		return theme.fg(color as never, text)
	} catch {
		return text
	}
}

export class HermesTextOverlayComponent implements Component {
	#tui: TUI
	#title: string
	#lines: string[]
	#onClose: () => void
	#scroll = 0
	#pathHint = ""
	#bodyStart = 0
	#bodyHit = 0

	constructor(tui: TUI, title: string, body: string, onClose: () => void, pathHint = "") {
		this.#tui = tui
		this.#title = title
		this.#lines = (body || "(empty)").replace(/\r\n/g, "\n").split("\n")
		this.#onClose = onClose
		this.#pathHint = pathHint
		enableOverlayScopedPaint(this.#tui, this)
	}

	handleInput(data: string): void {
		try {
			if (routeSgrMouseInput(data, (ev) => {
				if (ev.release) return true
				if (ev.wheel != null) {
					// Anywhere over the pager scrolls the body (single zone).
					this.#scrollBy(ev.wheel)
					return true
				}
				if (ev.leftClick) {
					// Click footer-ish bottom → close; body click focuses scroll only.
					const page = this.#pageSize()
					if (this.#bodyHit > 0 && ev.row >= this.#bodyStart + this.#bodyHit) {
						this.#onClose()
						return true
					}
					// click in body: no-op beyond consume (wheel does scroll)
					void page
					return true
				}
				return true
			})) {
				return
			}
			if (
				matchesSelectCancel(data) ||
				data === "q" ||
				matchesKey(data, "enter") ||
				matchesKey(data, "return") ||
				data === "\n"
			) {
				this.#onClose()
				return
			}
			const page = this.#pageSize()
			if (matchesSelectUp(data)) {
				this.#scrollBy(-1)
				return
			}
			if (matchesSelectDown(data)) {
				this.#scrollBy(1)
				return
			}
			if (matchesSelectPageUp(data)) {
				this.#scrollBy(-page)
				return
			}
			if (matchesSelectPageDown(data) || data === " ") {
				this.#scrollBy(page)
				return
			}
			if (data === "g") {
				this.#scroll = 0
				this.#paint()
				return
			}
			if (data === "G") {
				this.#scroll = Math.max(0, this.#lines.length - page)
				this.#paint()
			}
		} catch {
			/* never kill TUI */
		}
	}

	#pageSize(): number {
		return Math.max(5, (process.stdout.rows || 24) - 8)
	}

	#scrollBy(delta: number): void {
		const page = this.#pageSize()
		const max = Math.max(0, this.#lines.length - page)
		this.#scroll = Math.max(0, Math.min(max, this.#scroll + delta))
		this.#paint()
	}

	#paint(): void {
		paintOverlayLocal(this.#tui, this)
	}

	render(width: number): string[] {
		try {
			const w = Math.max(40, Math.floor(width) || 80)
			const page = this.#pageSize()
			const out: string[] = []
			out.push(topBorder(w, this.#title))
			if (this.#pathHint) {
				out.push(row(safeFg("dim", fit(this.#pathHint, w - 4)), w))
			}
			this.#bodyStart = out.length
			this.#bodyHit = 0
			const end = Math.min(this.#lines.length, this.#scroll + page)
			for (let i = this.#scroll; i < end; i++) {
				out.push(row(fit(this.#lines[i] ?? "", w - 4), w))
				this.#bodyHit++
			}
			if (this.#bodyHit === 0) {
				out.push(row(safeFg("dim", "(empty)"), w))
				this.#bodyHit = 1
			}
			out.push(bottomBorder(w))
			out.push(
				safeFg(
					"dim",
					fit(`wheel/↑↓ · PgUp/PgDn · q/Esc close · ${this.#scroll + 1}/${this.#lines.length}`, w),
				),
			)
			return out
		} catch (e) {
			const w = Math.max(40, Math.floor(width) || 80)
			return [topBorder(w, "pager error"), row(String(e), w), bottomBorder(w)]
		}
	}
}
