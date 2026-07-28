/**
 * Regression: hidden-thinking pulse must stop when answer prose starts (fast path).
 * Dogfood: omh kept spinning after Hermes finished thinking.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import type { AssistantMessage } from "@oh-my-pi/pi-ai";
import { AssistantMessageComponent } from "@oh-my-pi/pi-coding-agent/modes/components/assistant-message";
import { initTheme } from "@oh-my-pi/pi-coding-agent/modes/theme/theme";

beforeAll(async () => {
	await initTheme();
});

function msg(content: AssistantMessage["content"]): AssistantMessage {
	return {
		role: "assistant",
		content,
		api: "anthropic-messages",
		provider: "anthropic",
		model: "MiniMax-M3",
		usage: {
			input: 0,
			output: 8,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 8,
			reasoningTokens: 4,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

describe("assistant thinking pulse stop", () => {
	test("pulse disappears once answer text arrives on the fast path", () => {
		const c = new AssistantMessageComponent();
		c.hideThinkingBlock = true;

		// Thinking-only stream (hidden CoT → animated pulse).
		c.updateContent(
			msg([{ type: "thinking", thinking: "Planning the answer carefully step by step." }]),
			{ transient: true },
		);
		const whileThinking = Bun.stripANSI(c.render(80).join("\n"));
		expect(whileThinking.toLowerCase()).toContain("thinking");

		// Shape changes: thinking + text. Full rebuild path — pulse must stop.
		c.updateContent(
			msg([
				{ type: "thinking", thinking: "Planning the answer carefully step by step." },
				{ type: "text", text: "Biological, no contest." },
			]),
			{ transient: true },
		);
		const afterText = Bun.stripANSI(c.render(80).join("\n"));
		expect(afterText).toContain("Biological, no contest.");
		// Pulse label is " Thinking" (with leading space) from theme; answer body
		// should not keep the live pulse chrome once text is the tail.
		// (Collapsed headers use "▸ Thinking" only when thinking is visible.)
		expect(afterText).not.toMatch(/[✻✼❉❊✺✹✸✶]/);

		// Second text-only fast-path tick (same shape after thinking stays).
		c.updateContent(
			msg([
				{ type: "thinking", thinking: "Planning the answer carefully step by step." },
				{ type: "text", text: "Biological, no contest. Great ears." },
			]),
			{ transient: true },
		);
		const afterGrow = Bun.stripANSI(c.render(80).join("\n"));
		expect(afterGrow).toContain("Great ears");
		expect(afterGrow).not.toMatch(/[✻✼❉❊✺✹✸✶]/);
	});
});
