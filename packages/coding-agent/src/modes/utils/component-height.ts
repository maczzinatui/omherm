/**
 * Cross-frame height cache for mouse hit-tests.
 *
 * Main-screen SGR click routing used to call `child.render(width).length` on
 * every chat child (and again for nested Container grandchildren) just to
 * place the click. That re-enters Markdown/tool paint on the input hot path.
 *
 * Components that paint note their last height here; hit-tests read the cache
 * and only fall back to `render()` on a miss (cold or width change).
 */
import type { Component } from "@oh-my-pi/pi-tui";

type Entry = { width: number; height: number };

const heights = new WeakMap<object, Entry>();

/** Record height produced by a real paint. Call from `render()` after compose. */
export function noteComponentHeight(component: object, width: number, height: number): void {
	if (width <= 0 || height < 0) return;
	heights.set(component, { width, height });
}

/**
 * Height of `component` at `width`. Prefer last paint; on miss render once and
 * cache. Never throws — broken children report 0 so hit geometry stays sane.
 */
export function componentHeight(component: Component, width: number): number {
	if (width <= 0) return 0;
	const hit = heights.get(component);
	if (hit && hit.width === width) return hit.height;
	try {
		const h = component.render(width).length;
		heights.set(component, { width, height: h });
		return h;
	} catch {
		return 0;
	}
}

/** Drop cached height (theme/structure change). Next probe re-renders. */
export function invalidateComponentHeight(component: object): void {
	heights.delete(component);
}
