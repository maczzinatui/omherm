import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Component } from "@oh-my-pi/pi-tui";
import {
	coalesceTuiPaint,
	createRenderCounters,
	instrumentedTuiOptions,
} from "../../../src/modes/utils/perf-counters";

class FakeTui {
	calls: Array<{ kind: "render" | "scoped"; force?: boolean }> = [];
	requestRender = (forceOrOpts?: boolean | unknown, _maybeOpts?: unknown): void => {
		const isForced = typeof forceOrOpts === "boolean" ? forceOrOpts : false;
		this.calls.push({ kind: "render", force: isForced });
	};
	requestComponentRender = (_comp: Component): void => {
		this.calls.push({ kind: "scoped" });
	};
}

function flushMicrotasks(): Promise<void> {
	return new Promise(resolve => queueMicrotask(() => resolve()));
}

describe("perf-counters (MTUI_PERF=1)", () => {
	const originalEnv = process.env.MTUI_PERF;
	let stderrWrites: string[] = [];
	const origStderrWrite = process.stderr.write.bind(process.stderr);

	beforeEach(() => {
		stderrWrites = [];
		process.stderr.write = ((chunk: string | Uint8Array): boolean => {
			stderrWrites.push(typeof chunk === "string" ? chunk : chunk.toString());
			return true;
		}) as typeof process.stderr.write;
		process.env.MTUI_PERF = "1";
	});

	afterEach(() => {
		process.stderr.write = origStderrWrite;
		if (originalEnv === undefined) delete process.env.MTUI_PERF;
		else process.env.MTUI_PERF = originalEnv;
	});

	it("returns instrumented scheduler + counts when env is on", () => {
		const opts = instrumentedTuiOptions();
		expect(opts).toBeDefined();
		expect(opts!.renderScheduler).toBeDefined();

		const counters = createRenderCounters();
		expect(counters).toBeDefined();
		counters!.dispose();
	});

	it("wraps requestRender by kind and emits per window", async () => {
		const tui = new FakeTui();
		const counters = createRenderCounters()!;
		counters.wrap(tui);

		tui.requestRender(true);
		tui.requestRender();
		tui.requestComponentRender({ render: () => ["x"] } as Component);

		const snap = counters.snapshot();
		expect(snap.forced).toBe(1);
		expect(snap.scheduled).toBe(1);
		expect(snap.componentScoped).toBe(1);

		counters.dispose();
		expect(typeof tui.requestRender).toBe("function");
		tui.requestRender();
		tui.requestComponentRender({ render: () => [] } as Component);
	});

	it("does nothing when env is off", () => {
		process.env.MTUI_PERF = "0";
		expect(instrumentedTuiOptions()).toBeUndefined();
		expect(createRenderCounters()).toBeUndefined();
		process.env.MTUI_PERF = "1";
	});
});

describe("coalesceTuiPaint", () => {
	it("collapses N non-forced calls in one microtask to 1 paint", async () => {
		const tui = new FakeTui();
		const { restore, stats } = coalesceTuiPaint(tui);

		tui.requestRender();
		tui.requestRender();
		tui.requestRender();
		expect(tui.calls).toEqual([]);
		expect(stats.dropped).toBe(2);

		await flushMicrotasks();
		expect(tui.calls).toEqual([{ kind: "render", force: false }]);
		expect(stats.flushed).toBe(1);
		expect(stats.dropped).toBe(2);

		restore();
	});

	it("requestRender(true) bypasses coalesce and paints immediately", async () => {
		const tui = new FakeTui();
		const { restore, stats } = coalesceTuiPaint(tui);

		tui.requestRender(true);
		expect(tui.calls).toEqual([{ kind: "render", force: true }]);
		expect(stats.flushed).toBe(0);

		await flushMicrotasks();
		// No extra ordinary paint.
		expect(tui.calls).toEqual([{ kind: "render", force: true }]);

		restore();
	});

	it("forced paint cancels a pending ordinary microtask (no double paint)", async () => {
		const tui = new FakeTui();
		const { restore, stats } = coalesceTuiPaint(tui);

		tui.requestRender(); // schedule microtask
		tui.requestRender(true); // force — must invalidate pending
		expect(tui.calls).toEqual([{ kind: "render", force: true }]);
		expect(stats.cancelledByForce).toBe(1);

		await flushMicrotasks();
		expect(tui.calls).toEqual([{ kind: "render", force: true }]);
		expect(stats.flushed).toBe(0);

		restore();
	});

	it("after force, a later non-forced call still schedules", async () => {
		const tui = new FakeTui();
		const { restore } = coalesceTuiPaint(tui);

		tui.requestRender();
		tui.requestRender(true);
		await flushMicrotasks();
		tui.calls = [];

		tui.requestRender();
		await flushMicrotasks();
		expect(tui.calls).toEqual([{ kind: "render", force: false }]);

		restore();
	});

	it("with counters under coalesce (IM order), counters see post-coalesce paints", async () => {
		process.env.MTUI_PERF = "1";
		const tui = new FakeTui();
		const counters = createRenderCounters()!;
		// Same order as InteractiveMode: counters on raw, coalesce outer.
		counters.wrap(tui);
		const { restore } = coalesceTuiPaint(tui);

		tui.requestRender();
		tui.requestRender();
		tui.requestRender();
		// Before flush: coalesce has not called through — counters still 0.
		expect(counters.snapshot().scheduled).toBe(0);

		await flushMicrotasks();
		expect(counters.snapshot().scheduled).toBe(1);
		expect(tui.calls.length).toBe(1);

		restore();
		counters.dispose();
	});

	it("preserves method this (class private-field style requestRender)", async () => {
		// Regression: bare `const orig = t.requestRender` loses `this` and crashes
		// real TUI (`#pendingRenderComponentsOnly` on undefined).
		class MethodTui {
			#n = 0;
			calls = 0;
			requestRender(this: MethodTui, _force?: boolean | unknown): void {
				// Touch private field — throws if `this` is wrong.
				this.#n += 1;
				this.calls += 1;
			}
			requestComponentRender(_c: Component): void {}
		}
		const tui = new MethodTui();
		const { restore } = coalesceTuiPaint(tui as unknown as Parameters<typeof coalesceTuiPaint>[0]);
		tui.requestRender();
		await flushMicrotasks();
		expect(tui.calls).toBe(1);
		tui.requestRender(true);
		expect(tui.calls).toBe(2);
		restore();
	});
});
