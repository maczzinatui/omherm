/**
 * Simple fullscreen text pager for slash.exec / long CLI dumps.
 * Never throw out of render/input.
 */
import type { Component, TUI } from "@oh-my-pi/pi-tui"
import { matchesKey, visibleWidth } from "@oh-my-pi/pi-tui"
import { theme } from "../theme/theme"
import { bottomBorder, fit, row, topBorder } from "./overlay-box"
import { matchesSelectCancel, matchesSelectDown, matchesSelectPageDown, matchesSelectPageUp, matchesSelectUp } from "../utils/keybinding-matchers"
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
			if (matchesSelectCancel(data) || data === "q" || matchesKey(data, "enter") || matchesKey(data, "return") || data === "\n") {
				this.#onClose()
				return
			}
			const page = Math.max(5, (process.stdout.rows || 24) - 8)
			if (matchesSelectUp(data)) {
				this.#scroll = Math.max(0, this.#scroll - 1)
				this.#paint()
				return
			}
			if (matchesSelectDown(data)) {
				this.#scroll = Math.min(Math.max(0, this.#lines.length - 1), this.#scroll + 1)
				this.#paint()
				return
			}
			if (matchesSelectPageUp(data)) {
				this.#scroll = Math.max(0, this.#scroll - page)
				this.#paint()
				return
			}
			if (matchesSelectPageDown(data) || data === " ") {
				this.#scroll = Math.min(Math.max(0, this.#lines.length - page), this.#scroll + page)
				this.#paint()
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

	#paint(): void {
		paintOverlayLocal(this.#tui, this)
	}

	render(width: number): string[] {
		try {
			const w = Math.max(40, Math.floor(width) || 80)
			const termRows = Math.max(12, process.stdout.rows || 24)
			const bodyRows = Math.max(6, termRows - 6)
			const out: string[] = []
			const title = `${this.#title}  ${this.#scroll + 1}/${this.#lines.length}`
			out.push(topBorder(fit(title, w - 4), w))
			out.push(row(safeFg("dim", "↑↓ PgUp/PgDn space · g/G · Esc/q close"), w))
			if (this.#pathHint) {
				out.push(row(safeFg("muted", fit(`full: ${this.#pathHint}`, w - 4)), w))
			}
			const end = Math.min(this.#lines.length, this.#scroll + bodyRows)
			for (let i = this.#scroll; i < end; i++) {
				const line = this.#lines[i] ?? ""
				// soft-wrap long lines by visible width
				let rest = line
				let first = true
				while (rest.length > 0 || first) {
					first = false
					const chunk = fit(rest, w - 4)
					out.push(row(chunk, w))
					// advance by approx visible; if fit short-circuits empty, break
					if (visibleWidth(rest) <= w - 4) break
					// crude: drop chars until shorter
					let cut = Math.max(1, Math.floor((w - 4) * 0.9))
					while (cut < rest.length && visibleWidth(rest.slice(0, cut)) < w - 4) cut++
					rest = rest.slice(Math.max(1, cut - 8))
					if (out.length > termRows + 20) break
				}
				if (out.length > termRows + 20) break
			}
			if (end < this.#lines.length) {
				out.push(row(safeFg("dim", `… +${this.#lines.length - end} lines`), w))
			}
			out.push(bottomBorder(w))
			return out.slice(0, termRows)
		} catch (e) {
			return [`text overlay error: ${e instanceof Error ? e.message : String(e)}`]
		}
	}
}
