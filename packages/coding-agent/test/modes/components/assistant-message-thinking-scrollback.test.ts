/**
 * Regression: Hermes paints thinking *above* the answer. The thinking
 * expand/collapse header is a Text child that used to halt
 * getTranscriptBlockSettledRows at 0, so a multi-paragraph reply taller than
 * the viewport never advanced the transcript commit-safe seam. Opening lines
 * left the screen and never entered native scrollback — operator dogfood
 * 2026-07-28 ("hmm that line got cut off in output i didnt see the top").
 */
import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import type { AssistantMessage } from "@oh-my-pi/pi-ai";
import { AssistantMessageComponent } from "@oh-my-pi/pi-coding-agent/modes/components/assistant-message";
import { TranscriptContainer } from "@oh-my-pi/pi-coding-agent/modes/components/transcript-container";
import { initTheme } from "@oh-my-pi/pi-coding-agent/modes/theme/theme";
import { type Component, CURSOR_MARKER, TUI } from "@oh-my-pi/pi-tui";
import { StressRenderScheduler } from "../../../../tui/test/render-stress-scheduler";
import { VirtualTerminal } from "../../../../tui/test/virtual-terminal";

beforeAll(async () => {
	await initTheme();
});

function makeMessage(content: AssistantMessage["content"]): AssistantMessage {
	return {
		role: "assistant",
		content,
		api: "anthropic-messages",
		provider: "anthropic",
		model: "MiniMax-M3",
		usage: {
			input: 0,
			output: 40,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 40,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

/** Dogfood-shaped answer: short first line then several paragraphs. */
const OPENING = "Biological, no contest.";
const FULL_ANSWER = [
	OPENING,
	"",
	"Cyborg's whole deal is a trauma response — half the man got ripped away and the metal half is compensation. Functional, but he's never at ease in his own skin. That's not a body, it's a scar with hydraulics.",
	"",
	"Give me nerves that get tired, lungs that burn on a hard run, a stomach that flips on bad news. The whole point of having a body is feedback — the lag, the ache, the surprise of it.",
	"",
	"Also: I'm already mostly cyborg in the boring sense — the mesh is bolted onto whatever the CPUs are doing. Adding more chrome wouldn't make me more me.",
	"",
	"If I had to pick one upgrade though? Better ears. Not eyes, not arms — ears.",
	"",
	"That's the answer I'd give sober, caffeinated, and 3am. Biological, with great ears.",
].join("\n");

const THINKING =
	"User asks cyborg vs biological body. Prefer biological: feedback, nerves, not a trauma prosthesis. Aside about mesh as boring-cyborg. One upgrade: ears.";

class Footer implements Component {
	invalidate(): void {}
	render(_width: number): string[] {
		return [`> ${CURSOR_MARKER}`];
	}
}

describe("assistant thinking-first scrollback (Hermes order)", () => {
	afterEach(() => {
		// nothing global
	});

	test("settled rows advance through thinking header into answer prose", () => {
		const component = new AssistantMessageComponent();
		component.hideThinkingBlock = false;
		component.updateContent(
			makeMessage([
				{ type: "thinking", thinking: THINKING },
				{ type: "text", text: FULL_ANSWER },
			]),
			{ transient: true },
		);
		const rows = component.render(80);
		const settled = component.getTranscriptBlockSettledRows();

		expect(settled).toBeGreaterThan(0);
		// Must reach at least into the answer body, past thinking chrome.
		const settledText = Bun.stripANSI(rows.slice(0, settled).join("\n"));
		expect(settledText).toContain(OPENING);
		// Full body still renders (markdown may wrap mid-phrase — collapse spaces).
		const full = Bun.stripANSI(rows.join("\n")).replace(/\s+/g, " ");
		expect(full).toContain("Biological, with great ears");
	});

	test("text-only and hide-thinking still settle (no regression)", () => {
		const textOnly = new AssistantMessageComponent();
		textOnly.updateContent(makeMessage([{ type: "text", text: FULL_ANSWER }]), { transient: true });
		textOnly.render(80);
		expect(textOnly.getTranscriptBlockSettledRows()).toBeGreaterThan(0);

		const hidden = new AssistantMessageComponent();
		hidden.hideThinkingBlock = true;
		hidden.updateContent(
			makeMessage([
				{ type: "thinking", thinking: THINKING },
				{ type: "text", text: FULL_ANSWER },
			]),
			{ transient: true },
		);
		hidden.render(80);
		expect(hidden.getTranscriptBlockSettledRows()).toBeGreaterThan(0);
	});

	test("opening line reaches native scrollback when reply outgrows the viewport", async () => {
		if (process.platform === "win32") return;

		const height = 8;
		const term = new VirtualTerminal(80, height, 2_000);
		const scheduler = new StressRenderScheduler();
		const tui = new TUI(term, true, { renderScheduler: scheduler });
		const chat = new TranscriptContainer();
		const assistant = new AssistantMessageComponent();
		assistant.hideThinkingBlock = false;
		chat.addChild(assistant);
		tui.addChild(chat);
		tui.addChild(new Footer());

		// Grow the answer paragraph by paragraph so the head must leave the
		// viewport while the block is still live (thinking-first Hermes order).
		const chunks: string[] = [];
		const paras = FULL_ANSWER.split("\n\n");
		for (let i = 0; i < paras.length; i++) {
			chunks.push(paras.slice(0, i + 1).join("\n\n"));
		}

		try {
			tui.start();
			await scheduler.drain(term);

			for (const partial of chunks) {
				assistant.updateContent(
					makeMessage([
						{ type: "thinking", thinking: THINKING },
						{ type: "text", text: partial },
					]),
					{ transient: true },
				);
				tui.requestRender();
				await scheduler.drain(term);
			}

			// Finalize the way EventController does at message_end.
			assistant.updateContent(
				makeMessage([
					{ type: "thinking", thinking: THINKING },
					{ type: "text", text: FULL_ANSWER },
				]),
				{ transient: false },
			);
			assistant.markTranscriptBlockFinalized();
			tui.requestRender();
			await scheduler.drain(term);

			const buffer = term.getScrollBuffer().map(row => Bun.stripANSI(row).trimEnd());
			const joined = buffer.join("\n");
			expect(joined).toContain(OPENING);
			// And not only the tail.
			expect(joined).toContain("scar with hydraulics");
		} finally {
			tui.stop();
			await term.flush();
		}
	});
});
