/**
 * Top quick-access strip — footer-aesthetic, clickable chips with a fat hit box.
 *
 * Cadillac: coat owns chrome, Hermes owns turn. Chips deep-link coat overlays
 * (settings hub, kanban/sessions ports, model hub) — they never start a turn.
 *
 * Paint matches the bottom status line:
 * - solid `statusLineBg` only under the chip run (grows/shrinks with buttons)
 * - per-chip colors from the status-line segment palette
 * - `statusLineSep` between chips
 * - accent on hover
 */
import { type Component, type SgrMouseEvent, truncateToWidth, visibleWidth } from "@oh-my-pi/pi-tui";
import { type ThemeColor, theme } from "../theme/theme";

/** Minimal sink so the sticky bar can own editor focus without importing Editor. */
export type QuickAccessKeySink = {
	handleInput?(data: string): void;
};

/**
 * Footer segment colors, cycled across chips so the strip reads like the
 * status line (model / path / git / context / …). Unknown ids still get a
 * stable color from the cycle.
 */
const FOOTER_CHIP_TONES: readonly ThemeColor[] = [
	"statusLineModel",
	"statusLinePath",
	"statusLineGitClean",
	"statusLineContext",
	"statusLineSpend",
	"statusLineSubagents",
	"statusLineOutput",
	"statusLineCost",
];

/** Well-known chip ids → preferred footer tone (when present in the set). */
const CHIP_TONE_BY_ID: Readonly<Record<string, ThemeColor>> = {
	settings: "statusLinePath",
	kanban: "statusLineContext",
	sessions: "statusLineGitClean",
	model: "statusLineModel",
	tools: "statusLineSpend",
	agents: "statusLineSubagents",
};

/**
 * One clickable chip on the strip. `id` is opaque (used for hit-test
 * lookup); `label` is the visible glyph. Optional `tone` pins a status-line
 * color; otherwise id map + cycle apply. `onActivate` must stay cheap.
 */
export interface QuickAccessButton {
	id: string;
	label: string;
	onActivate: () => void;
	/** Override status-line segment color for this chip. */
	tone?: ThemeColor;
}

/**
 * Strip layout. Chips left-to-right; overflow drops trailing chips on narrow
 * terminals. Host ships Settings · Kanban · Sessions · Model.
 */
export class QuickAccessBar implements Component {
	/** Buttons in render order. Mutating the array re-renders on the next paint. */
	#buttons: QuickAccessButton[] = [];
	/** Hovered button id (accent highlight). Cleared on leave. */
	#hoveredId: string | null = null;
	/** Last painted content width (cells) — hit tests ignore cols past this. */
	#contentWidth = 0;
	/**
	 * Live editor (or other key target). Sticky chrome is an always-on overlay;
	 * pi-tui only allows focus on the top overlay **or** a component it
	 * `ownsOverlayFocusTarget`s. Without this, `setFocus(editor)` is rewritten
	 * back onto the bar and typing dies (bar has no default handleInput).
	 */
	#keySink: QuickAccessKeySink | null = null;

	/**
	 * Bind the component that should keep keyboard focus while this strip is
	 * the topmost overlay (normally CustomEditor). Call after the editor exists.
	 */
	setKeySink(sink: QuickAccessKeySink | null): void {
		this.#keySink = sink;
	}

	/**
	 * pi-tui overlay focus ownership — allow the editor to stay focused while
	 * this chrome overlay is painted on top of the transcript.
	 */
	ownsOverlayFocusTarget(component: Component): boolean {
		return this.#keySink !== null && component === this.#keySink;
	}

	/**
	 * Safety net: if focus lands on the bar (e.g. after another overlay hides
	 * and restores topVisible = chrome), forward keys to the editor sink.
	 */
	handleInput(data: string): void {
		this.#keySink?.handleInput?.(data);
	}

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

	/** Remove a button by id. No-op if absent. */
	removeButton(id: string): void {
		const idx = this.#buttons.findIndex(b => b.id === id);
		if (idx !== -1) this.#buttons.splice(idx, 1);
	}

	/** Test/inspection helper. */
	getButtons(): readonly QuickAccessButton[] {
		return this.#buttons;
	}

	/** Cells covered by the bg slab after last paint (0 if empty). */
	contentWidth(): number {
		return this.#contentWidth;
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
	 * hover/click handlers. Returns true when the event was consumed.
	 * Motion past the content slab clears hover and is not consumed so the
	 * host can treat it as "left the bar".
	 */
	handleMouse(event: SgrMouseEvent): boolean {
		// Wheel over the bar zone: swallow (host decided we're on the bar row).
		if (event.wheel !== null) return true;
		const onSlab = this.#contentWidth > 0 && event.col < this.#contentWidth + 1;
		if (event.motion || event.release) {
			if (!onSlab) {
				const had = this.#hoveredId !== null;
				this.clearHover();
				return had; // consume only if we cleared a hover (needs repaint)
			}
			this.handleHover(event.col);
			return true;
		}
		if (event.leftClick) {
			if (!onSlab) return false;
			return this.handleClick(event.col) !== undefined;
		}
		return false;
	}

	/** Horizontal padding cells around each chip glyph (widens click target). */
	static readonly CHIP_PAD = 0;
	/** Trailing empty rows under the content line. 0 = sit flush above splash. */
	static readonly TRAIL_ROWS = 0;
	/** Inner pad cells inside the bg slab (matches status-line ` ${parts} `). */
	static readonly SLAB_PAD = 1;
	/** Separator between chips (single cell; colored statusLineSep). */
	static readonly SEP = " ";

	/**
	 * Glyph for a button including horizontal pad spaces (hit + paint).
	 * Example: `〔Settings〕`
	 */
	#chipGlyph(label: string): string {
		const pad = " ".repeat(QuickAccessBar.CHIP_PAD);
		return `${pad}〔${label}〕${pad}`;
	}

	#toneFor(btn: QuickAccessButton, index: number): ThemeColor {
		if (btn.tone) return btn.tone;
		const mapped = CHIP_TONE_BY_ID[btn.id];
		if (mapped) return mapped;
		return FOOTER_CHIP_TONES[index % FOOTER_CHIP_TONES.length]!;
	}

	/**
	 * Style one chip like a status-line segment. Hover → accent (same
	 * “lights up” feel as footer interactive bits).
	 */
	#styleChip(btn: QuickAccessButton, index: number, glyph: string): string {
		const isActive = btn.id === this.#hoveredId;
		if (isActive) return theme.fg("accent", glyph);
		return theme.fg(this.#toneFor(btn, index), glyph);
	}

	/**
	 * Render the bar. Empty registry → collapse. Bg slab ends after the last
	 * visible chip (plus slab pad) and grows when buttons are added.
	 * Remainder of the terminal row is plain (no fill) so transcript shows through.
	 */
	render(width: number): readonly string[] {
		if (this.#buttons.length === 0 || width <= 0) {
			this.#contentWidth = 0;
			return [];
		}

		const slabPad = " ".repeat(QuickAccessBar.SLAB_PAD);
		const sepPlain = QuickAccessBar.SEP;
		const sepStyled = theme.fg("statusLineSep", sepPlain);

		const parts: string[] = [];
		// Track plain (unstyled) width for hit-test + slab sizing.
		let plainInner = "";
		let usedInner = 0;
		const maxInner = Math.max(0, width - QuickAccessBar.SLAB_PAD * 2);

		for (let i = 0; i < this.#buttons.length; i++) {
			const btn = this.#buttons[i]!;
			const glyph = this.#chipGlyph(btn.label);
			const segWidth = visibleWidth(glyph);
			const sepWidth = i === 0 ? 0 : visibleWidth(sepPlain);
			if (usedInner + segWidth + sepWidth > maxInner) break;
			if (i > 0) {
				parts.push(sepStyled);
				plainInner += sepPlain;
				usedInner += sepWidth;
			}
			parts.push(this.#styleChip(btn, i, glyph));
			plainInner += glyph;
			usedInner += segWidth;
		}

		if (usedInner === 0) {
			this.#contentWidth = 0;
			return [];
		}

		// Footer-style group: bg + pad + colored segments + pad. No full-row fill.
		const inner = parts.join("");
		const slabCore = `${slabPad}${inner}${slabPad}`;
		let slab = theme.bg("statusLineBg", slabCore);
		const slabW = visibleWidth(slabCore);
		this.#contentWidth = slabW;

		// If terminal is narrower mid-frame, hard-truncate the painted line.
		if (slabW > width) {
			slab = truncateToWidth(slab, width);
			this.#contentWidth = Math.min(slabW, width);
		}

		// Pad remainder with plain spaces (no bg) so overlay width can stay 100%
		// without painting a black bar across the whole row.
		const tail = Math.max(0, width - this.#contentWidth);
		const line = tail > 0 ? slab + " ".repeat(tail) : slab;

		const out: string[] = [line];
		for (let i = 0; i < QuickAccessBar.TRAIL_ROWS; i++) {
			out.push(" ".repeat(width));
		}
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

	/**
	 * True when `col` is over the painted slab (not the transparent tail).
	 * Host can use this to decide whether the pointer left the bar.
	 */
	isColOnSlab(col: number): boolean {
		return this.#contentWidth > 0 && col >= 0 && col < this.#contentWidth;
	}

	#hitTest(col: number): QuickAccessButton | undefined {
		// Hit geometry matches paint: SLAB_PAD then chips+seps.
		const sep = QuickAccessBar.SEP;
		let cursor = QuickAccessBar.SLAB_PAD;
		for (let i = 0; i < this.#buttons.length; i++) {
			const btn = this.#buttons[i]!;
			const glyph = this.#chipGlyph(btn.label);
			const w = visibleWidth(glyph);
			const softStart = Math.max(0, cursor - 1);
			if (col >= softStart && col < cursor + w) return btn;
			cursor += w;
			if (i < this.#buttons.length - 1) cursor += visibleWidth(sep);
		}
		return undefined;
	}
}
