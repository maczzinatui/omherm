/**
 * Collapsible thinking headers — long finalized CoT compacts to a clickable
 * ▸ header; toggle expands back to full italic body.
 */
import { beforeAll, describe, expect, it } from "bun:test";
import type { AssistantMessage } from "@oh-my-pi/pi-ai";
import { AssistantMessageComponent } from "../../../src/modes/components/assistant-message";
import { initTheme } from "../../../src/modes/theme/theme";

function makeMessage(thinking: string, text = "Done."): AssistantMessage {
	return {
		role: "assistant",
		content: [
			{ type: "thinking", thinking },
			{ type: "text", text },
		],
		api: "openai-completions",
		provider: "test",
		model: "test",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: Date.now(),
	} as AssistantMessage;
}

describe("AssistantMessageComponent thinking collapse", () => {
	beforeAll(async () => {
		await initTheme(false);
	});

	it("auto-compacts long thinking when the block is finalized", () => {
		const long = "x".repeat(AssistantMessageComponent.THINKING_AUTO_COLLAPSE_CHARS + 40);
		const comp = new AssistantMessageComponent(makeMessage(long));
		// Constructor with message marks transcript finalized.
		const lines = comp.render(80).join("\n");
		expect(lines).toContain("▸ Thinking");
		expect(lines).toContain("click to expand");
		// Full body should not dump the whole CoT when compacted.
		expect(lines.includes(long)).toBe(false);
	});

	it("expands on header click and collapses again on second toggle", () => {
		const long = "Reasoning step one.\n".repeat(40);
		const comp = new AssistantMessageComponent(makeMessage(long));
		const before = comp.render(80);
		// Hit-test the header line(s) recorded during render.
		let clicked = false;
		for (let row = 0; row < before.length; row++) {
			if (comp.handleThinkingHeaderClick(row)) {
				clicked = true;
				break;
			}
		}
		expect(clicked).toBe(true);
		const expanded = comp.render(80).join("\n");
		expect(expanded).toContain("▾ Thinking");
		expect(expanded).toContain("Reasoning step one");
		// Collapse again via API.
		expect(comp.toggleThinkingCollapsed(0)).toBe(true);
		const collapsed = comp.render(80).join("\n");
		expect(collapsed).toContain("▸ Thinking");
	});

	it("keeps short thinking expanded by default", () => {
		const short = "Quick note.";
		const comp = new AssistantMessageComponent(makeMessage(short));
		const lines = comp.render(80).join("\n");
		expect(lines).toContain("▾ Thinking");
		expect(lines).toContain("Quick note");
	});
});
