import { describe, expect, it } from "bun:test";
import type { Component } from "@oh-my-pi/pi-tui";
import {
	enableOverlayScopedPaint,
	paintOverlayFull,
	paintOverlayLocal,
	paintOverlayReload,
} from "../../../src/modes/utils/overlay-paint";

describe("overlay-paint (B2.5)", () => {
	it("paintOverlayLocal prefers requestComponentRender", () => {
		const calls: string[] = [];
		const tui = {
			requestRender: () => {
				calls.push("full");
			},
			requestComponentRender: (_c: Component) => {
				calls.push("local");
			},
		};
		const comp = { render: () => [] } as Component;
		paintOverlayLocal(tui, comp);
		expect(calls).toEqual(["local"]);
	});

	it("paintOverlayLocal falls back to requestRender", () => {
		const calls: string[] = [];
		const tui = {
			requestRender: () => {
				calls.push("full");
			},
			// no requestComponentRender
		} as { requestRender: () => void; requestComponentRender?: (c: Component) => void };
		paintOverlayLocal(tui as never, { render: () => [] } as Component);
		expect(calls).toEqual(["full"]);
	});

	it("paintOverlayFull always full", () => {
		const calls: string[] = [];
		const tui = {
			requestRender: () => {
				calls.push("full");
			},
			requestComponentRender: () => {
				calls.push("local");
			},
		};
		paintOverlayFull(tui);
		expect(calls).toEqual(["full"]);
	});

	it("paintOverlayReload: cold full, warm local", () => {
		const calls: string[] = [];
		const tui = {
			requestRender: () => {
				calls.push("full");
			},
			requestComponentRender: () => {
				calls.push("local");
			},
		};
		const comp = { render: () => [] } as Component;
		paintOverlayReload(tui, comp, true);
		paintOverlayReload(tui, comp, false);
		expect(calls).toEqual(["full", "local"]);
	});

	it("enableOverlayScopedPaint calls enable when present", () => {
		let seen: Component | undefined;
		const comp = { render: () => [] } as Component;
		enableOverlayScopedPaint(
			{
				requestRender: () => {},
				requestComponentRender: () => {},
				enableScopedInputRender: c => {
					seen = c;
				},
			},
			comp,
		);
		expect(seen).toBe(comp);
	});
});
