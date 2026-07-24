import { beforeAll, describe, expect, it } from "bun:test";
import { visibleWidth } from "@oh-my-pi/pi-tui";
import { ChatScrollOverlay } from "../../../src/modes/components/chat-scroll-overlay";
import { initTheme } from "../../../src/modes/theme/theme";

describe("ChatScrollOverlay", () => {
	beforeAll(async () => {
		await initTheme(false);
	});

	it("starts at bottom and wheel-up moves offset", () => {
		const lines = Array.from({ length: 40 }, (_, i) => `line-${i}`);
		let closed = 0;
		let renders = 0;
		const overlay = new ChatScrollOverlay({
			lines,
			bodyHeight: 10,
			onClose: () => {
				closed++;
			},
			requestRender: () => {
				renders++;
			},
		});
		expect(overlay.isAtBottom()).toBe(true);
		expect(overlay.handleWheel(-1)).toBe("scrolled");
		expect(overlay.isAtBottom()).toBe(false);
		expect(renders).toBeGreaterThan(0);
		overlay.handleWheel(1);
		let guard = 0;
		while (!overlay.isAtBottom() && guard++ < 50) overlay.handleWheel(1);
		expect(overlay.handleWheel(1)).toBe("close");
		expect(closed).toBe(1);
	});

	it("render includes header+footer+body rows", () => {
		const overlay = new ChatScrollOverlay({
			lines: ["a", "b", "c"],
			bodyHeight: 5,
			onClose: () => {},
			requestRender: () => {},
		});
		const out = overlay.render(80);
		expect(out.length).toBe(1 + 5 + 1);
		const plain = out.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
		expect(plain).toContain("history");
	});

	it("header/footer statusLineBg ends at text (not full terminal width)", () => {
		const overlay = new ChatScrollOverlay({
			lines: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
			bodyHeight: 5,
			onClose: () => {},
			requestRender: () => {},
		});
		const out = overlay.render(80);
		const header = out[0]!;
		const footer = out[out.length - 1]!;
		expect(header).toMatch(/\x1b\[[0-9;]*48/);
		expect(footer).toMatch(/\x1b\[[0-9;]*48/);
		expect(visibleWidth(header)).toBe(80);
		const plainHeader = header.replace(/\x1b\[[0-9;]*m/g, "").trimEnd();
		expect(plainHeader.length).toBeLessThan(50);
		expect(plainHeader).toContain("history");
		const plainFooter = footer.replace(/\x1b\[[0-9;]*m/g, "").trimEnd();
		expect(plainFooter.length).toBeLessThan(40);
	});
});
