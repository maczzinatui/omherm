/**
 * Click anywhere in reasoning (header or body) toggles collapse.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import type { AssistantMessage } from "@oh-my-pi/pi-ai";
import { AssistantMessageComponent } from "@oh-my-pi/pi-coding-agent/modes/components/assistant-message";
import { initTheme } from "@oh-my-pi/pi-coding-agent/modes/theme/theme";

beforeAll(async () => {
	await initTheme();
});

function msg(thinking: string, text: string): AssistantMessage {
	return {
		role: "assistant",
		content: [
			{ type: "thinking", thinking },
			{ type: "text", text },
		],
		api: "anthropic-messages",
		provider: "anthropic",
		model: "MiniMax-M3",
		usage: {
			input: 0,
			output: 20,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 20,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

const LONG_THINK =
	"Line one of reasoning about the body preference.\n" +
	"Line two continues the trauma-response argument.\n" +
	"Line three lands on biological with great ears.";

describe("assistant thinking body click toggle", () => {
	test("click mid-body collapses expanded thinking", () => {
		const c = new AssistantMessageComponent();
		c.hideThinkingBlock = false;
		c.updateContent(msg(LONG_THINK, "Biological, no contest."), { transient: false });
		c.markTranscriptBlockFinalized();
		// Force expanded (auto-collapse may compact long CoT after finalize).
		if (c.hasCollapsedThinking()) {
			c.toggleThinkingCollapsed(); // expand
		}
		const rows = c.render(80);
		const plain = rows.map(r => Bun.stripANSI(r));
		const bodyRow = plain.findIndex(r => r.includes("Line two continues"));
		expect(bodyRow).toBeGreaterThanOrEqual(0);

		expect(c.handleThinkingHeaderClick(bodyRow)).toBe(true);
		expect(c.hasCollapsedThinking()).toBe(true);

		const after = Bun.stripANSI(c.render(80).join("\n"));
		expect(after).toContain("▸ Thinking");
		expect(after).not.toContain("Line two continues");
	});

	test("click header expands collapsed thinking", () => {
		const c = new AssistantMessageComponent();
		c.hideThinkingBlock = false;
		c.updateContent(msg(LONG_THINK, "Answer."), { transient: false });
		c.markTranscriptBlockFinalized();
		if (!c.hasCollapsedThinking()) {
			c.toggleThinkingCollapsed(); // force collapse
		}
		const rows = c.render(80);
		const headerRow = rows.map(r => Bun.stripANSI(r)).findIndex(r => r.includes("▸ Thinking"));
		expect(headerRow).toBeGreaterThanOrEqual(0);
		expect(c.handleThinkingHeaderClick(headerRow)).toBe(true);
		expect(c.hasCollapsedThinking()).toBe(false);
		expect(Bun.stripANSI(c.render(80).join("\n"))).toContain("Line one of reasoning");
	});
});
