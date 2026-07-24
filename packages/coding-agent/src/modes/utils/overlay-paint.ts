/**
 * Overlay paint helpers (B2.5).
 *
 * Prefer `requestComponentRender(component)` for hover/sel/nav and soft
 * reload of overlay body. Use `requestRender()` only for structural show
 * open / first cold load when the host needs a guaranteed full frame.
 *
 * **pi-tui caveat (live as of coat pin):** `#resolvePartialComposeRoots`
 * returns null whenever `overlayStack.length > 0`, so scoped requests while
 * an overlay is open still full-compose. Calling component-scoped is still
 * correct API discipline (does not clear a pending scoped accumulation from
 * non-overlay paths the way bare `requestRender` does) and stays ready if
 * upstream ever allows overlay-local frames. Pair with coat `coalesceTuiPaint`
 * + hover timers to cut *call* storms even when compose stays full.
 */
import type { Component, TUI } from "@oh-my-pi/pi-tui";

export type OverlayPaintHost = Pick<TUI, "requestRender" | "requestComponentRender"> & {
	enableScopedInputRender?: (component: Component) => void;
};

/** Opt the overlay into pi-tui scoped-input render when available. */
export function enableOverlayScopedPaint(tui: OverlayPaintHost, component: Component): void {
	try {
		tui.enableScopedInputRender?.(component);
	} catch {
		/* optional */
	}
}

/** Hover / nav / soft body update — component-scoped when possible. */
export function paintOverlayLocal(tui: OverlayPaintHost, component: Component): void {
	try {
		if (typeof tui.requestComponentRender === "function") {
			tui.requestComponentRender(component);
			return;
		}
		tui.requestRender();
	} catch {
		try {
			tui.requestRender();
		} catch {
			/* never take down TUI */
		}
	}
}

/** Structural open / forced full frame. */
export function paintOverlayFull(tui: OverlayPaintHost): void {
	try {
		tui.requestRender();
	} catch {
		/* swallow */
	}
}

/**
 * Soft-reload policy: cold (empty) first paint may full-frame; warm and
 * completion always local so reload doesn't force a bare requestRender storm.
 */
export function paintOverlayReload(tui: OverlayPaintHost, component: Component, cold: boolean): void {
	if (cold) paintOverlayFull(tui);
	else paintOverlayLocal(tui, component);
}
