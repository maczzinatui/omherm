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
});
