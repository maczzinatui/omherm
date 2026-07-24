/**
 * Top quick-access strip — footer-aesthetic, clickable chips with a fat hit box.
 *
 * Cadillac: coat owns chrome, Hermes owns turn. Chips deep-link coat overlays
 * (settings hub, kanban/sessions ports, model hub) — they never start a turn.
 * Layout is dim-by-default, accent-on-hover, matching the OMP bottom footer.
 *
 * Layout: optional leading spacer (host-pushed), one padded content row, one
 * trailing spacer. Hit-test accepts the content row plus half the trailing
 * spacer so the click surface is taller than the glyph. Horizontal padding
 * widens the chip beyond the label.
 */
import { type Component, type SgrMouseEvent, visibleWidth } from "@oh-my-pi/pi-tui";
import { theme } from "../theme/theme";

/**
 * One clickable chip on the strip. `id` is opaque (used for hit-test
 * lookup); `label` is the visible glyph (no width cap — the registry owns
 * sizing and trimming). `onActivate` runs once per left-click; consumers
 * must keep it cheap (it is called from the input hot path).
 */
export interface QuickAccessButton {
	id: string;
	label: string;
	onActivate: () => void;
}

/**
 * Strip layout. Chips left-to-right; overflow drops trailing chips on narrow
 * terminals (see render width gate). Host ships Settings · Kanban · Sessions · Model.
 */
export class QuickAccessBar implements Component {
	/** Buttons in render order. Mutating the array re-renders on the next
	 *  paint — the component does not cache between renders. */
	#buttons: QuickAccessButton[] = [];
	/** Hovered button id (accent highlight). Cleared on leave. */
	#hoveredId: string | null = null;

	/**
	 * Replace the button set. Safe to call between paints. Re-renders are
	 * driven by the host calling `ui.requestRender()` after this returns.
	 */
	setButtons(buttons: readonly QuickAccessButton[]): void {
		this.#buttons = [...buttons];
	}

	/**
	 * Append or replace one button by id. Existing id → replace; new id →
	 * push. Re-render is the host's responsibility.
	 */
	upsertButton(button: QuickAccessButton): void {
		const idx = this.#buttons.findIndex(b => b.id === button.id);
		if (idx === -1) {
			this.#buttons.push(button);
		} else {
			this.#buttons[idx] = button;
		}
	}

	/**
	 * Remove a button by id. No-op if absent.
	 */
	removeButton(id: string): void {
		const idx = this.#buttons.findIndex(b => b.id === id);
		if (idx !== -1) this.#buttons.splice(idx, 1);
	}

	/** Test/inspection helper. */
	getButtons(): readonly QuickAccessButton[] {
		return this.#buttons;
	}

	/**
	 * Update hover state from a mouse motion event with a frame-local
	 * `col`. Returns true when hover changed (host should request render).
	 */
	handleHover(col: number): boolean {
		const next = this.#hitTest(col);
		const nextId = next?.id ?? null;
		if (nextId === this.#hoveredId) return false;
		this.#hoveredId = nextId;
		return true;
	}

	/** Clear hover when the pointer leaves the strip. */
	clearHover(): void {
		if (this.#hoveredId === null) return;
		this.#hoveredId = null;
	}

	/**
	 * Activate the button under `col` (if any). Returns the activated id
	 * for the host to log/track.
	 */
	handleClick(col: number): string | undefined {
		const btn = this.#hitTest(col);
		if (!btn) return undefined;
		btn.onActivate();
		return btn.id;
	}

	/** Hit-test only — no activate (tests / hover probes). */
	hitTestAt(col: number): string | undefined {
		return this.#hitTest(col)?.id;
	}

	/**
	 * Convenience: dispatch an SGR mouse event through the strip's
	 * hover/click handlers. Returns true when the event was consumed
	 * (left-click on a chip, or any motion/wheel within the bar so the
	 * editor does not get CSI junk — same policy as the chat-area
	 * router).
	 */
	handleMouse(event: SgrMouseEvent): boolean {
		// Wheel: swallow so it does not scroll the transcript.
		if (event.wheel !== null) return true;
		// Hover/motion: update hover state.
		if (event.motion || event.release) {
			this.handleHover(event.col);
			return true;
		}
		if (event.leftClick) {
			return this.handleClick(event.col) !== undefined;
		}
		return false;
	}

	/** Horizontal padding cells around each chip glyph (widens click target). */
	static readonly CHIP_PAD = 0;
	/** Trailing empty rows under the content line. 0 = sit flush above splash. */
	static readonly TRAIL_ROWS = 0;
	/** Separator between chips (keep short — multi-chip strip). */
	static readonly SEP = " ";

	/**
	 * Glyph for a button including horizontal pad spaces (hit + paint).
	 * Example: `〔Settings〕`
	 */
	#chipGlyph(label: string): string {
		const pad = " ".repeat(QuickAccessBar.CHIP_PAD);
		return `${pad}〔${label}〕${pad}`;
	}

	/**
	 * Render the bar. Empty registry → collapse. Otherwise one content
	 * row + trailing spacer(s). Chip is padded so the hit box is larger
	 * than the bare label.
	 */
	render(width: number): readonly string[] {
		if (this.#buttons.length === 0 || width <= 0) return [];
		const parts: string[] = [];
		let usedWidth = 0;
		const sep = theme.fg("dim", QuickAccessBar.SEP);
		for (let i = 0; i < this.#buttons.length; i++) {
			const btn = this.#buttons[i]!;
			const glyph = this.#chipGlyph(btn.label);
			const segWidth = visibleWidth(glyph);
			const sepWidth = i === 0 ? 0 : visibleWidth(sep);
			if (usedWidth + segWidth + sepWidth > width) break;
			const isActive = btn.id === this.#hoveredId;
			const styled = isActive ? theme.fg("accent", glyph) : theme.fg("dim", glyph);
			if (i > 0) parts.push(sep);
			parts.push(styled);
			usedWidth += segWidth + sepWidth;
		}
		const line = parts.join("");
		const trimmed = visibleWidth(line) > width ? truncateVisible(line, width) : line;
		const out: string[] = [trimmed];
		for (let i = 0; i < QuickAccessBar.TRAIL_ROWS; i++) out.push("");
		return out;
	}

	/**
	 * Rows that accept hover/click (content + trail). Host uses this so
	 * hit geometry stays in lockstep with paint.
	 */
	hitRowCount(): number {
		if (this.#buttons.length === 0) return 0;
		return 1 + QuickAccessBar.TRAIL_ROWS;
	}

	#hitTest(col: number): QuickAccessButton | undefined {
		const sep = QuickAccessBar.SEP;
		let cursor = 0;
		for (let i = 0; i < this.#buttons.length; i++) {
			const btn = this.#buttons[i]!;
			const glyph = this.#chipGlyph(btn.label);
			const w = visibleWidth(glyph);
			// Soft left edge: also accept a couple cells before the pad so a
			// slightly early click still lands.
			const softStart = Math.max(0, cursor - 1);
			if (col >= softStart && col < cursor + w) return btn;
			cursor += w;
			if (i < this.#buttons.length - 1) cursor += visibleWidth(sep);
		}
		return undefined;
	}
}

/**
 * Trim a styled string to `width` terminal cells without breaking SGR
 * escape codes. Strips ansi, truncates by visible columns, then returns
 * the original substring whose visible width matches — good enough for
 * the bar (which is short and only ever shrinks on overflow).
 */
function truncateVisible(text: string, width: number): string {
	// Walk visible cells; once we exceed `width` slice at the last
	// in-range character. SGR codes do not count.
	let visible = 0;
	let i = 0;
	let lastInRange = 0;
	while (i < text.length) {
		const ch = text[i]!;
		if (ch === "\x1b") {
			// Skip the entire escape sequence (CSI / OSC / etc.).
			const start = i;
			i++;
			if (text[i] === "[") {
				i++;
				while (i < text.length && text[i] !== "m" && text[i] !== "M" && text[i] !== "K") i++;
				if (i < text.length) i++;
			} else {
				while (i < text.length && text[i] !== "\x07" && text[i] !== "\x1b") i++;
			}
			if (visible > width) lastInRange = start;
			continue;
		}
		visible += 1;
		if (visible > width) {
			return text.slice(0, lastInRange);
		}
		lastInRange = i + 1;
		i++;
	}
	return text;
}
