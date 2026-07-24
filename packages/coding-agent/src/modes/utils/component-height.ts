/**
 * Cross-frame height cache for mouse hit-tests.
 *
 * Main-screen SGR click routing used to call `child.render(width).length` on
 * every chat child (and again for nested Container grandchildren) just to
 * place the click. That re-enters Markdown/tool paint on the input hot path.
 *
 * Components that paint note their last height here; hit-tests read the cache
 * and only fall back to `render()` on a miss (cold or width change).
 *
 * `Container` instances are special: their `render(width)` delegates to each
 * child and concatenates rows. Walking a Container's own cached height would
 * leave nested children stale after one of them grows (e.g. the editor
 * expanding to a multiline prompt). `componentHeight` therefore recurses into
 * Container children when it can — it sums the cached row counts of every
 * child whose cache is warm at `width`, only re-rendering the children that
 * miss. This keeps the post-grow click geometry in sync without a full
 * repaint on the input hot path.
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
 * Detect a Container-shaped value: has a `children` array. Structural check
 * (not `instanceof Container`) so chrome subclasses work without importing.
 */
function asContainer(component: Component): { children: Component[] } | undefined {
	const c = component as unknown as { children?: unknown };
	if (!c || !Array.isArray(c.children)) return undefined;
	return c as { children: Component[] };
}

/**
 * Height of `component` at `width`. Prefer last paint; on miss render once and
 * cache. Never throws — broken children report 0 so hit geometry stays sane.
 *
 * Container instances are walked recursively: the sum of cached child heights
 * is used when every child has a warm cache at `width`. The parent's own cache
 * is **not** written on the child-sum path so a later `noteComponentHeight` on
 * any child is not masked by a stale parent entry.
 */
export function componentHeight(component: Component, width: number): number {
	if (width <= 0) return 0;
	const hit = heights.get(component);
	if (hit && hit.width === width) return hit.height;

	const container = asContainer(component);
	if (container && container.children.length > 0) {
		let total = 0;
		let anyMiss = false;
		for (const child of container.children) {
			const childEntry = heights.get(child);
			if (childEntry && childEntry.width === width) {
				total += childEntry.height;
			} else {
				anyMiss = true;
				break;
			}
		}
		if (!anyMiss) {
			return total;
		}
		// At least one child cold — fall through to real render.
	}

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
