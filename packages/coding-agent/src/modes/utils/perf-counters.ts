/**
 * Opt-in render counters for coat TUI diagnosis.
 *
 * `MTUI_PERF=1` arms a thin scheduler wrapper that records
 * `scheduleImmediate` + `scheduleRender` ticks, plus a thin wrapper around
 * the TUI's `requestRender` / `requestComponentRender` methods to bucket
 * them by kind. Emits one stderr line per rolling 5s window. Default = zero
 * cost: nothing allocated, scheduler untouched, TUI untouched.
 *
 * Receipts to look for under live Hermes stream:
 *   `forced >> scoped`   → suspect overlay storms or status-line invalidation
 *                           loops.
 *   `scoped >> forced`   → normal streaming path (good).
 *   `scheduled` drops under burst + coat coalesce outer wrap → fewer paints
 *                           reach pi-tui than raw caller ticks (pair with unit
 *                           tests; pi-tui also coalesces internally ~30fps).
 *
 * Wiring (InteractiveMode):
 *   1. `createRenderCounters()?.wrap(tui)` on the raw TUI first.
 *   2. `coalesceTuiPaint(tui)` OUTSIDE counters so stderr counts paints that
 *      actually reach pi-tui (post-coalesce), not every brain tick.
 *   3. Dispose reverse: restore coalesce, then counters.dispose().
 */
import type { Component, RenderScheduler, RenderTimer, TUIOptions } from "@oh-my-pi/pi-tui";

export type RenderCountersSnapshot = {
	windowMs: number;
	forced: number;
	scheduled: number;
	componentScoped: number;
};

export type RenderCounters = {
	wrap(t: TuiLike): void;
	snapshot(): RenderCountersSnapshot;
	dispose(): void;
};

export type TuiLike = {
	requestRender: (...a: unknown[]) => void;
	requestComponentRender: (comp: Component) => void;
};

export type CoalesceStats = {
	/** Non-forced calls that were dropped because a microtask paint was already queued. */
	dropped: number;
	/** Microtasks that fired and called through to the inner requestRender. */
	flushed: number;
	/** Microtasks aborted because a forced paint ran first. */
	cancelledByForce: number;
};

/**
 * Microtask coalesce wrapper for `tui.requestRender`. Many bursty Hermes
 * brain events (message.delta, tool.progress, etc.) each call `requestRender`
 * once; under streaming they land within the same event-loop tick. Without
 * coalescing, every call enters pi-tui's request path (which also coalesces
 * frames ~30fps — this coat layer is belt-and-suspenders + shell parity with
 * `hermes-interactive-shell.ts` `paintScheduled`).
 *
 * `requestRender(true, ...)` ALWAYS passes through immediately and invalidates
 * any pending microtask via a generation counter so a forced clearScrollback
 * paint is not followed by a stale ordinary paint from a prior schedule.
 *
 * Returns `{ restore, stats }` — call `restore()` on dispose.
 */
export function coalesceTuiPaint(t: TuiLike): { restore: () => void; stats: CoalesceStats } {
	const stats: CoalesceStats = { dropped: 0, flushed: 0, cancelledByForce: 0 };
	let generation = 0;
	let scheduled = false;
	// Must bind — bare method extract loses TUI private-field `this`.
	const orig = t.requestRender.bind(t) as TuiLike["requestRender"];
	t.requestRender = (forceOrOpts?: boolean | unknown, maybeOpts?: unknown) => {
		const isForced = typeof forceOrOpts === "boolean" ? forceOrOpts : false;
		if (isForced) {
			// Invalidate any pending ordinary microtask.
			if (scheduled) {
				stats.cancelledByForce += 1;
			}
			generation += 1;
			scheduled = false;
			orig(forceOrOpts, maybeOpts);
			return;
		}
		if (scheduled) {
			stats.dropped += 1;
			return;
		}
		scheduled = true;
		const gen = generation;
		queueMicrotask(() => {
			if (gen !== generation) {
				// Forced paint already ran; do not double-paint.
				return;
			}
			scheduled = false;
			stats.flushed += 1;
			orig(forceOrOpts, maybeOpts);
		});
	};
	return {
		restore: () => {
			generation += 1;
			scheduled = false;
			t.requestRender = orig;
		},
		stats,
	};
}

const WINDOW_MS = 5_000;

function isPerfOn(): boolean {
	for (const k of ["OMHERM_PERF", "MTUI_PERF", "MESHINA_TUI_PERF"] as const) {
		const v = process.env[k];
		if (!v) continue;
		const t = v.trim().toLowerCase();
		if (t === "1" || t === "true" || t === "yes" || t === "on") return true;
	}
	return false;
}

/** Process-start epoch for boot timeline (ms). */
const BOOT_T0 = performance.now();
const bootMarks = new Map<string, number>();

/**
 * Stamp a named boot milestone. With `MTUI_PERF=1` / `OMHERM_PERF=1`, emits
 * `[mtui-boot] name=+Nms` on stderr. Safe no-op when perf is off (still records
 * in-memory for tests via `bootTimelineSnapshot`).
 */
export function bootMark(name: string): void {
	const at = performance.now() - BOOT_T0;
	bootMarks.set(name, at);
	if (!isPerfOn()) return;
	process.stderr.write(`[mtui-boot] ${name}=+${at.toFixed(1)}ms\n`);
}

/** Test / diagnostics: ordered boot marks since process entry of this module. */
export function bootTimelineSnapshot(): Array<{ name: string; ms: number }> {
	return [...bootMarks.entries()].map(([name, ms]) => ({ name, ms }));
}

/**
 * Build a `TUIOptions` snippet with an instrumented `renderScheduler` when
 * `MTUI_PERF` is set; returns `undefined` otherwise. Pass the result as the
 * third argument to `new TUI(...)`.
 */
export function instrumentedTuiOptions(): TUIOptions | undefined {
	if (!isPerfOn()) return undefined;
	const sched = makeScheduler();
	return { renderScheduler: sched.scheduler };
}

/**
 * Request-side counters. Wraps TUI's `requestRender` / `requestComponentRender`
 * after construction to bucket paints by kind. Returns `undefined` when env
 * is off.
 */
export function createRenderCounters(): RenderCounters | undefined {
	if (!isPerfOn()) return undefined;
	return makeCounters();
}

type SchedulerHandle = {
	scheduler: RenderScheduler;
	paints: () => number;
	coalesced: () => number;
};

function makeScheduler(): SchedulerHandle {
	let paints = 0;
	let coalesced = 0;
	const inner: RenderScheduler = {
		now: () => performance.now(),
		scheduleImmediate: cb => {
			paints += 1;
			setImmediate(cb);
		},
		scheduleRender: (cb, delay) => {
			let cancelled = false;
			const handle = setTimeout(() => {
				if (cancelled) return;
				paints += 1;
				cb();
			}, delay);
			(handle as { unref?: () => void }).unref?.();
			const wrappedTimer: RenderTimer = {
				cancel: () => {
					if (!cancelled) coalesced += 1;
					cancelled = true;
					clearTimeout(handle);
				},
			};
			return wrappedTimer;
		},
	};
	return {
		scheduler: inner,
		paints: () => paints,
		coalesced: () => coalesced,
	};
}

function makeCounters(): RenderCounters {
	let tui: TuiLike | undefined;
	let origRender: ((...a: unknown[]) => void) | undefined;
	let origScoped: ((c: Component) => void) | undefined;
	let forced = 0;
	let scheduled = 0;
	let componentScoped = 0;
	let windowStart = 0;
	let pendingFlush: ReturnType<typeof setTimeout> | undefined;
	let pendingSinceLastEmit = false;

	function emit(reason: string): void {
		if (!pendingSinceLastEmit) return;
		const windowMs = windowStart > 0 ? performance.now() - windowStart : 0;
		const pad = (n: number): string => n.toString().padStart(5, " ");
		process.stderr.write(
			`[mtui-perf] reason=${reason} window=${(windowMs / 1000).toFixed(1)}s ` +
				`forced=${pad(forced)} scheduled=${pad(scheduled)} scoped=${pad(componentScoped)}\n`,
		);
		forced = 0;
		scheduled = 0;
		componentScoped = 0;
		windowStart = 0;
		pendingSinceLastEmit = false;
	}

	function scheduleFlush(): void {
		if (pendingFlush) return;
		if (windowStart === 0) windowStart = performance.now();
		pendingFlush = setTimeout(() => {
			pendingFlush = undefined;
			emit("tick");
		}, WINDOW_MS);
		pendingFlush.unref?.();
	}

	return {
		wrap(t: TuiLike) {
			if (tui) return;
			tui = t;
			origRender = t.requestRender.bind(t);
			origScoped = t.requestComponentRender.bind(t);

			t.requestRender = (forceOrOpts?: boolean | unknown, maybeOpts?: unknown) => {
				const isForced = typeof forceOrOpts === "boolean" ? forceOrOpts : false;
				if (isForced) forced += 1;
				else scheduled += 1;
				pendingSinceLastEmit = true;
				scheduleFlush();
				origRender!(forceOrOpts, maybeOpts);
			};
			t.requestComponentRender = (comp: Component) => {
				componentScoped += 1;
				pendingSinceLastEmit = true;
				scheduleFlush();
				origScoped!(comp);
			};
		},
		snapshot(): RenderCountersSnapshot {
			const windowMs = windowStart > 0 ? performance.now() - windowStart : 0;
			return { windowMs, forced, scheduled, componentScoped };
		},
		dispose() {
			if (pendingFlush) {
				clearTimeout(pendingFlush);
				pendingFlush = undefined;
			}
			if (tui && origRender) tui.requestRender = origRender as typeof tui.requestRender;
			if (tui && origScoped) tui.requestComponentRender = origScoped as typeof tui.requestComponentRender;
			if (windowStart > 0) emit("dispose");
			tui = undefined;
			origRender = undefined;
			origScoped = undefined;
		},
	};
}
