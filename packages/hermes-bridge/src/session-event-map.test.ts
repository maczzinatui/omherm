import { describe, expect, test } from "bun:test";
import { GatewayTurnMapper } from "./session-event-map.ts";
import { mapGatewayToUi, type GatewayEvent } from "./types.ts";

describe("GatewayTurnMapper", () => {
	test("streams thinking + text into message_update deltas", () => {
		const m = new GatewayTurnMapper({ model: "grok-4.5", provider: "xai" });
		const evs = [
			...m.feedUi({ kind: "info", info: { model: "grok-4.5", reasoning_effort: "low" } }),
			...m.feedUi({ kind: "thinking", text: "plan " }),
			...m.feedUi({ kind: "thinking", text: "A", done: true }),
			...m.feedUi({ kind: "text", text: "Hello" }),
			...m.feedUi({ kind: "text", text: " world" }),
			...m.feedUi({ kind: "text", text: "Hello world", done: true }),
			...m.feedUi({ kind: "turn_end", usage: { input_tokens: 10, output_tokens: 5 } }),
		];
		const types = evs.map((e) => e.type);
		expect(types).toContain("agent_start");
		expect(types).toContain("turn_start");
		expect(types).toContain("message_start");
		expect(types).toContain("message_update");
		expect(types).toContain("message_end");
		expect(types).toContain("turn_end");
		expect(types).toContain("agent_end");

		const deltas = evs.filter((e) => e.type === "message_update");
		const hasTextDelta = deltas.some(
			(e) => e.type === "message_update" && e.assistantMessageEvent.type === "text_delta",
		);
		const hasThinkDelta = deltas.some(
			(e) => e.type === "message_update" && e.assistantMessageEvent.type === "thinking_delta",
		);
		expect(hasTextDelta).toBe(true);
		expect(hasThinkDelta).toBe(true);

		const end = evs.find((e) => e.type === "turn_end");
		expect(end && end.type === "turn_end" && end.message.model).toBe("grok-4.5");
		expect(end && end.type === "turn_end" && end.message.usage.input).toBe(10);
	});

	test("maps tool lifecycle", () => {
		const m = new GatewayTurnMapper();
		const evs = [
			...m.feedUi({ kind: "tool_start", id: "t1", name: "terminal", args: '{"command":"ls"}' }),
			...m.feedUi({ kind: "tool_update", id: "t1", preview: "file.txt" }),
			...m.feedUi({ kind: "tool_end", id: "t1", name: "terminal", summary: "ok" }),
			...m.feedUi({ kind: "turn_end" }),
		];
		const types = evs.map((e) => e.type);
		expect(types).toContain("tool_execution_start");
		expect(types).toContain("tool_execution_update");
		expect(types).toContain("tool_execution_end");
		const start = evs.find((e) => e.type === "tool_execution_start");
		expect(start && start.type === "tool_execution_start" && start.toolName).toBe("terminal");
		expect(start && start.type === "tool_execution_start" && (start.args as { command?: string }).command).toBe(
			"ls",
		);
	});

	test("gateway event path via mapGatewayToUi", () => {
		const m = new GatewayTurnMapper();
		const gw: GatewayEvent[] = [
			{ type: "message.delta", payload: { text: "hi" } },
			{ type: "message.complete", payload: { text: "hi", status: "complete", usage: { output_tokens: 1 } } },
		];
		const out: string[] = [];
		for (const g of gw) {
			for (const e of m.feedGateway(g, mapGatewayToUi)) out.push(e.type);
		}
		expect(out).toContain("message_update");
		expect(out).toContain("agent_end");
	});

	test("message.complete does not triple-paste already streamed text", () => {
		const m = new GatewayTurnMapper();
		const body = "The full Black Speech is only sparsely recorded.";
		m.feedUi({ kind: "text", text: body.slice(0, 10) });
		m.feedUi({ kind: "text", text: body.slice(10) });
		const afterStream = m.feedUi({ kind: "text", text: body, done: true });
		const end = afterStream.find((e) => e.type === "message_end" || e.type === "message_update");
		// After complete, content should have exactly one text block equal to body
		const turn = m.feedUi({ kind: "turn_end" });
		const te = turn.find((e) => e.type === "turn_end");
		expect(te && te.type === "turn_end").toBe(true);
		if (te && te.type === "turn_end") {
			const texts = te.message.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text);
			expect(texts.length).toBe(1);
			expect(texts[0]).toBe(body);
		}
		void end;
	});

	test("tool.start de-dupes same tool_id", () => {
		const m = new GatewayTurnMapper();
		const a = m.feedUi({ kind: "tool_start", id: "t1", name: "skill_view", args: '{"name":"x"}' });
		const b = m.feedUi({ kind: "tool_start", id: "t1", name: "skill_view", args: '{"name":"x"}' });
		const starts = [...a, ...b].filter((e) => e.type === "tool_execution_start");
		expect(starts.length).toBe(1);
	});

	test("cumulative delta snapshots do not double buffer", () => {
		const m = new GatewayTurnMapper();
		m.feedUi({ kind: "text", text: "Hel" });
		m.feedUi({ kind: "text", text: "Hello" }); // cumulative
		const fin = m.feedUi({ kind: "text", text: "Hello world", done: true });
		const te = [...fin, ...m.feedUi({ kind: "turn_end" })].find((e) => e.type === "turn_end");
		expect(te && te.type === "turn_end").toBe(true);
		if (te && te.type === "turn_end") {
			const t = te.message.content.find((c) => c.type === "text") as { text: string };
			expect(t.text).toBe("Hello world");
		}
	});
});
