import { describe, expect, test } from "bun:test";
import { GatewayTurnMapper, parsePersistedToolResult } from "./session-event-map.ts";
import { mapGatewayToUi, type GatewayEvent } from "./types.ts";

describe("GatewayTurnMapper", () => {
	test("session.info retains reasoning_effort on setIdentity paint path", () => {
		const m = new GatewayTurnMapper({ model: "old", provider: "old-p" });
		m.feedUi({
			kind: "info",
			info: { model: "grok-4.5", provider: "xai", reasoning_effort: "high" },
		});
		expect(m.model).toBe("grok-4.5");
		expect(m.provider).toBe("xai");
		expect(m.reasoningEffort).toBe("high");
		m.setIdentity("m2", "p2", "low");
		expect(m.reasoningEffort).toBe("low");
	});

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

	test("reasoning that restates the answer is dropped (no bright+dim twin)", () => {
		const m = new GatewayTurnMapper();
		const body =
			"Real time is Thu Jul 23 2026 in America/Toronto (EDT, UTC-4). The Shire doesn't have a live clock.";
		m.feedUi({ kind: "text", text: body });
		// MiniMax-style: full answer dumped as reasoning.available after stream
		m.feedUi({ kind: "thinking", text: body, done: true });
		const te = m.feedUi({ kind: "turn_end" }).find((e) => e.type === "turn_end");
		expect(te && te.type === "turn_end").toBe(true);
		if (te && te.type === "turn_end") {
			const texts = te.message.content.filter((c) => c.type === "text");
			const thinks = te.message.content.filter((c) => c.type === "thinking");
			expect(texts.length).toBe(1);
			expect(thinks.length).toBe(0);
			expect((texts[0] as { text: string }).text).toBe(body);
		}
	});

	test("text then reasoning.available same body via gateway map", () => {
		const m = new GatewayTurnMapper();
		const body =
			"Half the Shire's economy runs on it, the whole point is you don't buy it — you trade a few meals.";
		const gw: GatewayEvent[] = [
			{ type: "message.delta", payload: { text: body } },
			{ type: "reasoning.available", payload: { text: body } },
			{ type: "message.complete", payload: { text: body, status: "complete" } },
		];
		let te: ReturnType<GatewayTurnMapper["feedUi"]>[number] | undefined;
		for (const g of gw) {
			for (const e of m.feedGateway(g, mapGatewayToUi)) {
				if (e.type === "turn_end") te = e;
			}
		}
		expect(te && te.type === "turn_end").toBe(true);
		if (te && te.type === "turn_end") {
			expect(te.message.content.filter((c) => c.type === "text").length).toBe(1);
			expect(te.message.content.filter((c) => c.type === "thinking").length).toBe(0);
		}
	});

	test("real distinct reasoning is kept", () => {
		const m = new GatewayTurnMapper();
		m.feedUi({ kind: "thinking", text: "Need local timezone then lore joke." });
		m.feedUi({ kind: "thinking", text: "Need local timezone then lore joke.", done: true });
		m.feedUi({ kind: "text", text: "It's Thursday in Toronto. Want lore flavor?" });
		const te = m.feedUi({ kind: "turn_end" }).find((e) => e.type === "turn_end");
		if (te && te.type === "turn_end") {
			expect(te.message.content.some((c) => c.type === "thinking")).toBe(true);
			expect(te.message.content.some((c) => c.type === "text")).toBe(true);
		}
	});

	test("post-tool text strips re-emitted pre-tool preamble", () => {
		const m = new GatewayTurnMapper();
		const pre =
			"The user is asking about X-Files Season 3 Episode 20. Let me think about this. Jose Chung episode.";
		const post = "Here's the plot summary: Scully writes a book.";
		m.feedUi({ kind: "text", text: pre });
		m.feedUi({ kind: "tool_start", id: "t1", name: "web_search", args: '{"query":"xfiles"}' });
		m.feedUi({
			kind: "tool_end",
			id: "t1",
			name: "web_search",
			summary: "Did 5 searches in 0.8s",
			result: {
				data: {
					web: [
						{ title: "Jose Chung", url: "https://example.com/jc", description: "ep guide" },
						{ title: "X-Files wiki", url: "https://example.com/xf", description: "wiki" },
					],
				},
			},
		});
		// Model re-sends preamble + new prose
		m.feedUi({ kind: "text", text: pre + post });
		const te = m.feedUi({ kind: "turn_end" }).find((e) => e.type === "turn_end");
		expect(te && te.type === "turn_end").toBe(true);
		if (te && te.type === "turn_end") {
			const texts = te.message.content
				.filter((c) => c.type === "text")
				.map((c) => (c as { text: string }).text);
			expect(texts.length).toBe(2);
			expect(texts[0]).toBe(pre);
			expect(texts[1]).toBe(post);
			// preamble must not appear twice
			const joined = texts.join("");
			expect(joined.indexOf(pre)).toBe(joined.lastIndexOf(pre));
		}
	});

	test("terminal tool normalizes command args and paints bash-shaped details", () => {
		const m = new GatewayTurnMapper();
		const start = m.feedUi({
			kind: "tool_start",
			id: "t-term",
			name: "terminal",
			args: JSON.stringify({ command: "date", workdir: "/tmp" }),
		});
		const ts = start.find((e) => e.type === "tool_execution_start");
		expect(ts && ts.type === "tool_execution_start").toBe(true);
		if (ts && ts.type === "tool_execution_start") {
			const a = ts.args as { command?: string; cwd?: string };
			expect(a.command).toBe("date");
			expect(a.cwd).toBe("/tmp");
		}
		const end = m.feedUi({
			kind: "tool_end",
			id: "t-term",
			name: "terminal",
			summary: "Fri Jul 24",
			result: { output: "Fri Jul 24\n", exit_code: 0 },
		});
		const te = end.find((e) => e.type === "tool_execution_end");
		expect(te && te.type === "tool_execution_end").toBe(true);
		if (te && te.type === "tool_execution_end") {
			const r = te.result as {
				content: Array<{ text: string }>;
				details?: { exitCode?: number };
			};
			expect(r.content[0]?.text).toContain("Fri Jul 24");
			expect(r.details?.exitCode).toBe(0);
		}
	});

	test("persisted-output tool result paints compact badge not full dump", () => {
		const fat = "line\n".repeat(200);
		const hermes = [
			"<persisted-output>",
			"This tool result was too large (50,000 characters, 48.8 KB).",
			"Full output saved to: /tmp/hermes-results/call_abc123.txt",
			"Use the read_file tool with offset and limit to access specific sections of this output.",
			"",
			"Preview (first 1500 chars):",
			fat.slice(0, 400),
			"...",
			"</persisted-output>",
		].join("\n");
		const parsed = parsePersistedToolResult(hermes);
		expect(parsed).not.toBeNull();
		expect(parsed!.hasPath).toBe(true);
		expect(parsed!.badge).toContain("truncated");
		expect(parsed!.badge).toMatch(/KB|MB/);
		expect(parsed!.path).toContain("hermes-results");
		expect(parsed!.preview.length).toBeLessThan(hermes.length);

		const m = new GatewayTurnMapper();
		const end = m.feedUi({
			kind: "tool_end",
			id: "t-persist",
			name: "terminal",
			summary: hermes,
			result: { output: hermes, exit_code: 0 },
		});
		const te = end.find((e) => e.type === "tool_execution_end");
		expect(te && te.type === "tool_execution_end").toBe(true);
		if (te && te.type === "tool_execution_end") {
			const r = te.result as {
				content: Array<{ text: string }>;
				details?: { persisted?: { hasPath?: boolean; path?: string }; exitCode?: number };
			};
			expect(r.content[0]?.text).toContain("truncated");
			expect(r.content[0]?.text).toContain("read_file");
			expect(r.content[0]?.text.length).toBeLessThan(hermes.length);
			expect(r.details?.persisted?.hasPath).toBe(true);
			expect(r.details?.persisted?.path).toContain("call_abc123");
			expect(r.details?.exitCode).toBe(0);
		}
	});

	test("inline truncate fallback paints badge without path", () => {
		const text =
			"preview head here\n\n[Truncated: tool response was 12,345 chars. Full output could not be saved to sandbox.]";
		const parsed = parsePersistedToolResult(text);
		expect(parsed).not.toBeNull();
		expect(parsed!.hasPath).toBe(false);
		expect(parsed!.badge).toContain("truncated");
		expect(parsed!.badge).toContain("not saved");
	});

	test("browser_navigate normalizes to open+url", () => {
		const m = new GatewayTurnMapper();
		const start = m.feedUi({
			kind: "tool_start",
			id: "b1",
			name: "browser_navigate",
			args: "https://example.com/foo",
		});
		const ts = start.find((e) => e.type === "tool_execution_start");
		if (ts && ts.type === "tool_execution_start") {
			const a = ts.args as { action?: string; url?: string };
			expect(a.action).toBe("open");
			expect(a.url).toContain("example.com");
		}
	});

	test("read_file maps path for OMP read renderer", () => {
		const m = new GatewayTurnMapper();
		const start = m.feedUi({
			kind: "tool_start",
			id: "r1",
			name: "read_file",
			args: JSON.stringify({ path: "/home/nixos/meshina/README.md" }),
		});
		const ts = start.find((e) => e.type === "tool_execution_start");
		if (ts && ts.type === "tool_execution_start") {
			const a = ts.args as { path?: string; file_path?: string };
			expect(a.path).toContain("README.md");
			expect(a.file_path).toContain("README.md");
		}
	});

	test("web_search tool_end paints OMP search details", () => {
		const m = new GatewayTurnMapper();
		m.feedUi({ kind: "tool_start", id: "s1", name: "web_search", args: "X-Files s3e20" });
		const end = m.feedUi({
			kind: "tool_end",
			id: "s1",
			name: "web_search",
			summary: "Did 2 searches in 0.5s",
			result: {
				data: {
					web: [{ title: "A", url: "https://a.example", description: "aa" }],
				},
			},
		});
		const te = end.find((e) => e.type === "tool_execution_end");
		expect(te && te.type === "tool_execution_end").toBe(true);
		if (te && te.type === "tool_execution_end") {
			const r = te.result as {
				content: Array<{ text: string }>;
				details?: { response?: { sources?: unknown[] } };
			};
			expect(r.details?.response?.sources?.length).toBe(1);
			expect(r.content[0]?.text).toContain("Did 2 searches");
		}
	});

	test("message.complete.reasoning is thinking-first and stripped from text", () => {
		const m = new GatewayTurnMapper();
		const cot =
			"Key facts I know:\n- Located in Clarington\n- About 80 km east of Toronto\nI'll give a direct useful answer without padding.";
		const answer =
			"Newcastle is a small community in Clarington, Durham Region, about 80 km east of Toronto on Lake Ontario.";
		const gw: GatewayEvent[] = [
			{ type: "message.delta", payload: { text: answer } },
			{
				type: "message.complete",
				payload: {
					text: `${cot}\n\n${answer}`,
					reasoning: cot,
					status: "complete",
				},
			},
		];
		let te: ReturnType<GatewayTurnMapper["feedUi"]>[number] | undefined;
		for (const g of gw) {
			for (const e of m.feedGateway(g, mapGatewayToUi)) {
				if (e.type === "turn_end") te = e;
			}
		}
		expect(te && te.type === "turn_end").toBe(true);
		if (te && te.type === "turn_end") {
			const parts = te.message.content;
			const thinks = parts.filter((c) => c.type === "thinking");
			const texts = parts.filter((c) => c.type === "text") as Array<{ type: "text"; text: string }>;
			// thinking first
			expect(parts[0]?.type).toBe("thinking");
			expect(thinks.length).toBe(1);
			expect(texts.length).toBe(1);
			expect(texts[0]!.text).toContain("Newcastle is a small community");
			expect(texts[0]!.text).not.toContain("Key facts I know");
			expect(texts[0]!.text).not.toContain("without padding");
		}
	});

	test("late reasoning after text does not leave CoT twin in answer body", () => {
		const m = new GatewayTurnMapper();
		const cot = "Let me plan the tone. Casual operator voice, keep it short, no fluff padding.";
		const answer = "Newcastle ON is in Clarington on Lake Ontario, east of Toronto.";
		m.feedUi({ kind: "text", text: answer + "\n\n" + cot });
		m.feedUi({ kind: "thinking", text: cot, done: true });
		const te = m.feedUi({ kind: "turn_end" }).find((e) => e.type === "turn_end");
		if (te && te.type === "turn_end") {
			const text = te.message.content
				.filter((c) => c.type === "text")
				.map((c) => (c as { text: string }).text)
				.join("");
			// CoT stripped from answer; may remain as thinking OR dropped if near-dup of text before strip order
			expect(text).not.toContain("no fluff padding");
			expect(text).toContain("Clarington");
		}
	});
});

describe("mapGatewayToUi status / thinking", () => {
	test("thinking.delta is status-only (kaomoji)", () => {
		const u = mapGatewayToUi({ type: "thinking.delta", payload: { text: "(°ロ°) formulating..." } });
		expect(u).toEqual({ kind: "status", text: "(°ロ°) formulating..." });
	});

	test("reasoning.delta still maps to thinking", () => {
		const u = mapGatewayToUi({ type: "reasoning.delta", payload: { text: "hmm" } });
		expect(u).toEqual({ kind: "thinking", text: "hmm" });
	});

	test("status.update process is status; lifecycle is lifecycle", () => {
		expect(mapGatewayToUi({ type: "status.update", payload: { kind: "process", text: "busy" } })).toEqual({
			kind: "status",
			text: "busy",
		});
		expect(mapGatewayToUi({ type: "status.update", payload: { kind: "lifecycle", text: "HTTP 404" } })).toEqual({
			kind: "lifecycle",
			text: "HTTP 404",
		});
	});

	test("mapper paints status as working_status not thinking", () => {
		const m = new GatewayTurnMapper();
		const evs = m.feedUi({ kind: "status", text: "(°ロ°) formulating..." });
		expect(evs).toEqual([{ type: "working_status", message: "(°ロ°) formulating..." }]);
		const think = m.feedUi({ kind: "thinking", text: "real reason " });
		expect(think.some((e) => e.type === "message_update")).toBe(true);
	});
});

describe("P2 mapper gap — subagent / review / browser / moa / background", () => {
	test("mapGatewayToUi maps subagent lifecycle", () => {
		expect(
			mapGatewayToUi({
				type: "subagent.start",
				payload: { subagent_id: "s1", goal: "probe", preview: "go" },
			}),
		).toEqual({
			kind: "subagent_start",
			subagentId: "s1",
			goal: "probe",
			preview: "go",
		});
		expect(
			mapGatewayToUi({
				type: "subagent.tool",
				payload: { subagent_id: "s1", tool: "terminal", preview: "ls" },
			}),
		).toMatchObject({ kind: "subagent_tool", subagentId: "s1", tool: "terminal" });
		expect(
			mapGatewayToUi({
				type: "subagent.complete",
				payload: { subagent_id: "s1", preview: "done" },
			}),
		).toMatchObject({ kind: "subagent_complete", subagentId: "s1", preview: "done" });
		expect(mapGatewayToUi({ type: "subagent.start", payload: {} })).toBeNull();
	});

	test("mapGatewayToUi maps review / browser / moa / background", () => {
		expect(mapGatewayToUi({ type: "review.summary", payload: { text: "lgtm" } })).toEqual({
			kind: "review_summary",
			text: "lgtm",
		});
		expect(
			mapGatewayToUi({
				type: "browser.progress",
				payload: { message: "nav", level: "info" },
			}),
		).toEqual({ kind: "browser_progress", message: "nav", level: "info" });
		expect(
			mapGatewayToUi({
				type: "background.complete",
				payload: { task_id: "t1", text: "bg done" },
			}),
		).toEqual({ kind: "background_complete", taskId: "t1", text: "bg done" });
		expect(
			mapGatewayToUi({
				type: "moa.reference",
				payload: { url: "https://x", title: "X" },
			}),
		).toMatchObject({ kind: "moa_reference", url: "https://x", title: "X" });
	});

	test("GatewayTurnMapper surfaces gap events as notices / working_status (not transcript)", () => {
		const m = new GatewayTurnMapper();
		const start = m.feedUi({ kind: "subagent_start", subagentId: "s1", goal: "g" });
		expect(start.some((e) => e.type === "notice")).toBe(true);
		expect(start.some((e) => e.type === "message_update")).toBe(false);
		const text = m.feedUi({ kind: "subagent_text", subagentId: "s1", text: "hi" });
		expect(text).toEqual([{ type: "working_status", message: "subagent: hi" }]);
		const think = m.feedUi({ kind: "subagent_thinking", subagentId: "s1", text: "..." });
		expect(think).toEqual([]);
		const bg = m.feedUi({ kind: "background_complete", taskId: "t", text: "ok" });
		expect(bg[0]?.type).toBe("notice");
	});
});
