/**
 * Viewport history browser for the main chat.
 *
 * pi-tui paints bottom-anchored live chrome and commits older rows to *native*
 * terminal scrollback. With base SGR mouse tracking on, the host no longer owns
 * plain wheel / PgUp / PgDn — those events hit the app. This overlay is the
 * app-side scroll surface: snapshot the still-mounted transcript, ScrollView it,
 * Esc / End / wheel-past-bottom returns to the live tail.
 */
import {
	type Component,
	matchesKey,
	routeSgrMouseInput,
	ScrollView,
	truncateToWidth,
	visibleWidth,
} from "@oh-my-pi/pi-tui";
import { theme } from "../theme/theme";

export interface ChatScrollOverlayOptions {
	/** Pre-wrapped transcript rows (ANSI OK). */
	lines: readonly string[];
	/** Visible body rows (excludes 1 header + 1 footer). */
	bodyHeight: number;
	/** Called when the user exits review (Esc, q, or scroll past bottom). */
	onClose: () => void;
	/** Request a repaint after scroll/key. */
	requestRender: () => void;
}

/**
 * Footer-style slab: `statusLineBg` only under the label text,
 * plain transparent tail for the rest of the row (matches quick-access chips).
 */
function contentSlab(label: string, termWidth: number): string {
	const w = Math.max(1, termWidth);
	const core = label;
	const coreW = visibleWidth(core);
	if (coreW <= 0) return " ".repeat(w);
	const slabCore = coreW > w ? truncateToWidth(core, w) : core;
	const slab = theme.bg("statusLineBg", slabCore);
	const slabW = visibleWidth(slabCore);
	const tail = Math.max(0, w - slabW);
	return tail > 0 ? slab + " ".repeat(tail) : slab;
}

export class ChatScrollOverlay implements Component {
	#lines: string[];
	#bodyHeight: number;
	#scroll: ScrollView;
	#onClose: () => void;
	#requestRender: () => void;
	#closed = false;

	constructor(opts: ChatScrollOverlayOptions) {
		this.#lines = [...opts.lines];
		this.#bodyHeight = Math.max(1, opts.bodyHeight);
		this.#onClose = opts.onClose;
		this.#requestRender = opts.requestRender;
		this.#scroll = new ScrollView(this.#lines, {
			height: this.#bodyHeight,
			scrollbar: "auto",
			theme: {
				track: t => theme.fg("dim", t),
				thumb: t => theme.fg("accent", t),
			},
		});
		// Open parked at the live tail (most recent rows).
		this.#scroll.scrollToBottom();
	}

	/** Replace body geometry after resize. */
	setBodyHeight(height: number): void {
		this.#bodyHeight = Math.max(1, height);
		this.#scroll.setHeight(this.#bodyHeight);
	}

	/** Replace snapshot lines (rare — keep offset if possible). */
	setLines(lines: readonly string[]): void {
		const atBottom = this.#scroll.getScrollOffset() >= this.#scroll.getMaxScrollOffset();
		const prev = this.#scroll.getScrollOffset();
		this.#lines = [...lines];
		this.#scroll.setLines(this.#lines);
		if (atBottom) this.#scroll.scrollToBottom();
		else this.#scroll.setScrollOffset(prev);
	}

	/** True when the viewport is already showing the newest rows. */
	isAtBottom(): boolean {
		return this.#scroll.getScrollOffset() >= this.#scroll.getMaxScrollOffset();
	}

	/**
	 * Apply a wheel notch. Returns `"close"` when the user wheels down past the
	 * bottom (return to live tail), `"scrolled"` when offset moved, `"noop"` else.
	 */
	handleWheel(delta: -1 | 1): "close" | "scrolled" | "noop" {
		if (this.#closed) return "noop";
		const before = this.#scroll.getScrollOffset();
		if (delta > 0 && this.isAtBottom()) {
			this.close();
			return "close";
		}
		// 3 rows per notch — same feel as agent transcript viewer.
		this.#scroll.scroll(delta * 3);
		const after = this.#scroll.getScrollOffset();
		if (after === before) return "noop";
		this.#requestRender();
		return "scrolled";
	}

	handleInput(data: string): void {
		if (this.#closed) return;
		if (matchesKey(data, "escape") || data === "q" || data === "Q") {
			this.close();
			return;
		}
		if (matchesKey(data, "pageDown") || matchesKey(data, "ctrl+f")) {
			if (this.isAtBottom()) {
				this.close();
				return;
			}
			this.#scroll.page(1);
			this.#requestRender();
			return;
		}
		if (matchesKey(data, "pageUp") || matchesKey(data, "ctrl+b")) {
			this.#scroll.page(-1);
			this.#requestRender();
			return;
		}
		if (matchesKey(data, "home") || data === "g") {
			this.#scroll.scrollToTop();
			this.#requestRender();
			return;
		}
		if (matchesKey(data, "end") || data === "G") {
			this.#scroll.scrollToBottom();
			this.#requestRender();
			return;
		}
		if (this.#scroll.handleScrollKey(data)) {
			this.#requestRender();
		}
	}

	/** SGR mouse inside the overlay frame (row 0 = top of overlay). */
	handleMouseData(data: string): boolean {
		return routeSgrMouseInput(data, event => {
			if (event.wheel !== null) {
				this.handleWheel(event.wheel);
				return true;
			}
			// Swallow motion/clicks so they don't hit the editor under us.
			return true;
		});
	}

	close(): void {
		if (this.#closed) return;
		this.#closed = true;
		this.#onClose();
	}

	invalidate(): void {
		// ScrollView has no layout cache.
	}

	render(width: number): string[] {
		const w = Math.max(1, width);
		// Content-width black boxes — stop at the last glyph, not the terminal edge.
		const headerRaw = contentSlab(
			theme.fg("dim", " ↑ history ") + theme.fg("muted", "· wheel / PgUp·PgDn · Esc live "),
			w,
		);
		const body = this.#scroll.render(w);
		const off = this.#scroll.getScrollOffset();
		const max = this.#scroll.getMaxScrollOffset();
		const pos =
			max <= 0 ? "live" : `${Math.min(off + this.#bodyHeight, this.#lines.length)}/${this.#lines.length}`;
		const footerRaw = contentSlab(
			theme.fg("dim", ` ${pos} `) + theme.fg("muted", max <= 0 ? "· nothing above " : "· End / Esc → live "),
			w,
		);
		return [headerRaw, ...body, footerRaw];
	}
}
