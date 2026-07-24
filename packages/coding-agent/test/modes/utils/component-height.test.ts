import { describe, expect, it } from "bun:test";
import type { Component } from "@oh-my-pi/pi-tui";
import { componentHeight, noteComponentHeight, invalidateComponentHeight } from "../../../src/modes/utils/component-height";
import { frame } from "../../../src/modes/components/hermes-splash-art";

describe("componentHeight cache", () => {
	it("returns noted height without re-render", () => {
		let renders = 0;
		const c: Component = {
			render(width: number) {
				renders++;
				return Array.from({ length: 7 }, () => "x".repeat(width));
			},
		};
		noteComponentHeight(c, 80, 7);
		expect(componentHeight(c, 80)).toBe(7);
		expect(renders).toBe(0);
		// width miss → render once
		expect(componentHeight(c, 100)).toBe(7);
		expect(renders).toBe(1);
		// second hit at 100 is cached
		expect(componentHeight(c, 100)).toBe(7);
		expect(renders).toBe(1);
	});

	it("invalidate forces re-render", () => {
		let renders = 0;
		const c: Component = {
			render() {
				renders++;
				return ["a", "b"];
			},
		};
		noteComponentHeight(c, 40, 2);
		invalidateComponentHeight(c);
		expect(componentHeight(c, 40)).toBe(2);
		expect(renders).toBe(1);
	});

	it("Container child-sum uses warm children without parent render (B2.2)", () => {
		let parentRenders = 0;
		const childA: Component = {
			render() {
				return ["a1", "a2"];
			},
		};
		const childB: Component = {
			render() {
				return ["b1"];
			},
		};
		noteComponentHeight(childA, 80, 2);
		noteComponentHeight(childB, 80, 1);
		const parent = {
			children: [childA, childB],
			render() {
				parentRenders++;
				return ["p"];
			},
		} as unknown as Component;
		expect(componentHeight(parent, 80)).toBe(3);
		expect(parentRenders).toBe(0);
		// Child growth visible without parent cache masking
		noteComponentHeight(childB, 80, 4);
		expect(componentHeight(parent, 80)).toBe(6);
		expect(parentRenders).toBe(0);
	});
});

describe("hermes splash frame cache", () => {
	it("second identical frame is faster and equal", () => {
		const a = frame(100, 32, { chrome: 4 });
		const b = frame(100, 32, { chrome: 4 });
		expect(b.lines).toEqual(a.lines);
		expect(b.inner).toEqual(a.inner);
		// shared line array reference from LRU hit
		expect(b.lines).toBe(a.lines);
	});
});
