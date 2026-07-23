// Map Hermes gateway / UiEvent stream → OMP AgentEvent-shaped payloads.
// Used at the InteractiveMode edge so EventController can paint Hermes turns
// without a dual brain or rewriting AgentSession.

import type { GatewayEvent, UiEvent, Usage } from "./types.ts";

/** Minimal AssistantMessage-compatible shape (duck-typed for EventController). */
export type MappedAssistantMessage = {
	role: "assistant";
	content: MappedContent[];
	api: "hermes-gateway";
	provider: string;
	model: string;
	usage: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		totalTokens: number;
		cost: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
	};
	stopReason: "stop" | "length" | "toolUse" | "error" | "aborted";
	timestamp: number;
	errorMessage?: string;
};

export type MappedContent =
	| { type: "text"; text: string }
	| { type: "thinking"; thinking: string }
	| { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> };

export type MappedToolResult = {
	role: "toolResult";
	toolCallId: string;
	toolName: string;
	content: Array<{ type: "text"; text: string }>;
	isError: boolean;
	timestamp: number;
};

export type MappedAssistantMessageEvent =
	| { type: "start"; partial: MappedAssistantMessage }
	| { type: "text_start"; contentIndex: number; partial: MappedAssistantMessage }
	| { type: "text_delta"; contentIndex: number; delta: string; partial: MappedAssistantMessage }
	| { type: "text_end"; contentIndex: number; content: string; partial: MappedAssistantMessage }
	| { type: "thinking_start"; contentIndex: number; partial: MappedAssistantMessage }
	| { type: "thinking_delta"; contentIndex: number; delta: string; partial: MappedAssistantMessage }
	| { type: "thinking_end"; contentIndex: number; content: string; partial: MappedAssistantMessage }
	| {
			type: "done";
			reason: "stop" | "length" | "toolUse";
			message: MappedAssistantMessage;
	  }
	| {
			type: "error";
			reason: "aborted" | "error";
			error: MappedAssistantMessage;
	  };

/** Subset of AgentSessionEvent / AgentEvent that EventController needs for one turn. */
export type MappedAgentSessionEvent =
	| { type: "agent_start" }
	| { type: "agent_end"; messages: MappedAssistantMessage[] }
	| { type: "turn_start" }
	| { type: "turn_end"; message: MappedAssistantMessage; toolResults: MappedToolResult[] }
	| { type: "message_start"; message: MappedAssistantMessage }
	| {
			type: "message_update";
			message: MappedAssistantMessage;
			assistantMessageEvent: MappedAssistantMessageEvent;
	  }
	| { type: "message_end"; message: MappedAssistantMessage }
	| { type: "tool_execution_start"; toolCallId: string; toolName: string; args: unknown }
	| {
			type: "tool_execution_update";
			toolCallId: string;
			toolName: string;
			args: unknown;
			partialResult: unknown;
	  }
	| {
			type: "tool_execution_end";
			toolCallId: string;
			toolName: string;
			result: unknown;
			isError?: boolean;
	  }
	| { type: "notice"; level: "info" | "warning" | "error"; message: string; source?: string };

export type TurnMapperOptions = {
	model?: string;
	provider?: string;
};

function emptyUsage() {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

function applyGatewayUsage(u?: Usage) {
	const base = emptyUsage();
	if (!u) return base;
	base.input = u.input_tokens ?? 0;
	base.output = u.output_tokens ?? 0;
	base.totalTokens = u.total_tokens ?? base.input + base.output;
	if (u.cost_usd != null) base.cost.total = u.cost_usd;
	return base;
}

function parseArgs(raw?: string): Record<string, unknown> {
	if (!raw) return {};
	try {
		const v = JSON.parse(raw);
		if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
		return { input: v };
	} catch {
		return { input: raw };
	}
}

/**
 * Stateful mapper: feed UiEvents (or GatewayEvents via mapGatewayToUi first)
 * and receive OMP-shaped agent session events for EventController.
 */
export class GatewayTurnMapper {
	private model: string;
	private provider: string;
	private agentOpen = false;
	private turnOpen = false;
	private messageOpen = false;
	private textIndex: number | null = null;
	private thinkingIndex: number | null = null;
	private textBuf = "";
	private thinkingBuf = "";
	private content: MappedContent[] = [];
	private toolResults: MappedToolResult[] = [];
	private toolMeta = new Map<string, { name: string; args: unknown }>();
	private lastToolId = "";
	private timestamp = Date.now();

	constructor(opts: TurnMapperOptions = {}) {
		this.model = opts.model || "hermes";
		this.provider = opts.provider || "hermes";
	}

	setIdentity(model?: string, provider?: string) {
		if (model) this.model = model;
		if (provider) this.provider = provider;
	}

	private snapshot(stopReason: MappedAssistantMessage["stopReason"] = "stop", err?: string): MappedAssistantMessage {
		return {
			role: "assistant",
			content: this.content.map((c) => structuredClone(c)),
			api: "hermes-gateway",
			provider: this.provider,
			model: this.model,
			usage: emptyUsage(),
			stopReason,
			timestamp: this.timestamp,
			errorMessage: err,
		};
	}

	private ensureAgentTurn(): MappedAgentSessionEvent[] {
		const out: MappedAgentSessionEvent[] = [];
		if (!this.agentOpen) {
			this.agentOpen = true;
			out.push({ type: "agent_start" });
		}
		if (!this.turnOpen) {
			this.turnOpen = true;
			this.timestamp = Date.now();
			out.push({ type: "turn_start" });
		}
		if (!this.messageOpen) {
			this.messageOpen = true;
			const msg = this.snapshot();
			out.push({ type: "message_start", message: msg });
			out.push({
				type: "message_update",
				message: msg,
				assistantMessageEvent: { type: "start", partial: msg },
			});
		}
		return out;
	}

	private closeThinking(): MappedAgentSessionEvent[] {
		if (this.thinkingIndex === null) return [];
		const idx = this.thinkingIndex;
		const content = this.thinkingBuf;
		this.thinkingIndex = null;
		const msg = this.snapshot();
		return [
			{
				type: "message_update",
				message: msg,
				assistantMessageEvent: { type: "thinking_end", contentIndex: idx, content, partial: msg },
			},
		];
	}

	private closeText(): MappedAgentSessionEvent[] {
		if (this.textIndex === null) return [];
		const idx = this.textIndex;
		const content = this.textBuf;
		this.textIndex = null;
		const msg = this.snapshot();
		return [
			{
				type: "message_update",
				message: msg,
				assistantMessageEvent: { type: "text_end", contentIndex: idx, content, partial: msg },
			},
		];
	}

	/** Feed one UiEvent; returns zero or more mapped OMP events. */
	feedUi(ev: UiEvent): MappedAgentSessionEvent[] {
		switch (ev.kind) {
			case "info":
				this.setIdentity(ev.info.model, ev.info.provider);
				return [];
			case "user":
				// New user turn — close previous agent if still open (defensive)
				return this.forceEnd("stop");
			case "thinking":
				return this.onThinking(ev.text, ev.done);
			case "text":
				return this.onText(ev.text, ev.done);
			case "tool_start":
				return this.onToolStart(ev.id, ev.name, ev.args);
			case "tool_update":
				return this.onToolUpdate(ev.id, ev.preview);
			case "tool_end":
				return this.onToolEnd(ev.id, ev.name, ev.summary, ev.error);
			case "turn_end":
				return this.finishTurn(ev.usage, "stop");
			case "error":
				return this.finishTurn(undefined, "error", ev.text);
			case "status":
			case "stderr":
			case "ready":
			case "clarify":
			case "approval":
				if (ev.kind === "clarify" || ev.kind === "approval") {
					return [
						{
							type: "notice",
							level: "warning",
							message: ev.kind === "clarify" ? ev.question : ev.description || ev.command,
							source: "hermes-gateway",
						},
					];
				}
				return [];
			default:
				return [];
		}
	}

	/** Convenience: feed raw gateway event through mapGatewayToUi first. */
	feedGateway(ev: GatewayEvent, mapFn: (e: GatewayEvent) => UiEvent | UiEvent[] | null): MappedAgentSessionEvent[] {
		const mapped = mapFn(ev);
		if (!mapped) return [];
		const list = Array.isArray(mapped) ? mapped : [mapped];
		const out: MappedAgentSessionEvent[] = [];
		for (const u of list) out.push(...this.feedUi(u));
		return out;
	}

	private onThinking(text: string, done?: boolean): MappedAgentSessionEvent[] {
		const out = this.ensureAgentTurn();
		out.push(...this.closeText());

		if (this.thinkingIndex === null) {
			this.thinkingIndex = this.content.length;
			this.thinkingBuf = "";
			this.content.push({ type: "thinking", thinking: "" });
			const msg = this.snapshot();
			out.push({
				type: "message_update",
				message: msg,
				assistantMessageEvent: { type: "thinking_start", contentIndex: this.thinkingIndex, partial: msg },
			});
		}

		if (done) {
			this.thinkingBuf = text || this.thinkingBuf;
		} else {
			this.thinkingBuf += text;
		}
		const block = this.content[this.thinkingIndex!];
		if (block?.type === "thinking") block.thinking = this.thinkingBuf;

		const msg = this.snapshot();
		out.push({
			type: "message_update",
			message: msg,
			assistantMessageEvent: {
				type: "thinking_delta",
				contentIndex: this.thinkingIndex!,
				delta: done ? "" : text,
				partial: msg,
			},
		});
		if (done) out.push(...this.closeThinking());
		return out;
	}

	private onText(text: string, done?: boolean): MappedAgentSessionEvent[] {
		const out = this.ensureAgentTurn();
		out.push(...this.closeThinking());

		if (done && text && !this.textBuf) {
			// complete-only payload with full text
			this.textIndex = this.content.length;
			this.textBuf = text;
			this.content.push({ type: "text", text });
			const msg = this.snapshot();
			out.push({
				type: "message_update",
				message: msg,
				assistantMessageEvent: { type: "text_start", contentIndex: this.textIndex, partial: msg },
			});
			out.push({
				type: "message_update",
				message: msg,
				assistantMessageEvent: {
					type: "text_delta",
					contentIndex: this.textIndex,
					delta: text,
					partial: msg,
				},
			});
			out.push(...this.closeText());
			return out;
		}

		if (this.textIndex === null) {
			this.textIndex = this.content.length;
			this.textBuf = "";
			this.content.push({ type: "text", text: "" });
			const msg = this.snapshot();
			out.push({
				type: "message_update",
				message: msg,
				assistantMessageEvent: { type: "text_start", contentIndex: this.textIndex, partial: msg },
			});
		}

		if (!done) {
			this.textBuf += text;
			const block = this.content[this.textIndex!];
			if (block?.type === "text") block.text = this.textBuf;
			const msg = this.snapshot();
			out.push({
				type: "message_update",
				message: msg,
				assistantMessageEvent: {
					type: "text_delta",
					contentIndex: this.textIndex!,
					delta: text,
					partial: msg,
				},
			});
		} else {
			if (text) this.textBuf = text;
			const block = this.content[this.textIndex!];
			if (block?.type === "text") block.text = this.textBuf;
			out.push(...this.closeText());
		}
		return out;
	}

	private onToolStart(id: string, name: string, argsText?: string): MappedAgentSessionEvent[] {
		const out = this.ensureAgentTurn();
		out.push(...this.closeThinking());
		out.push(...this.closeText());
		const args = parseArgs(argsText);
		const toolId = id || `tool_${this.toolMeta.size + 1}`;
		this.lastToolId = toolId;
		this.toolMeta.set(toolId, { name, args });
		this.content.push({ type: "toolCall", id: toolId, name, arguments: args });
		out.push({ type: "tool_execution_start", toolCallId: toolId, toolName: name, args });
		return out;
	}

	private onToolUpdate(id: string, preview?: string): MappedAgentSessionEvent[] {
		const toolId = id || this.lastToolId;
		const meta = this.toolMeta.get(toolId) || { name: "tool", args: {} };
		if (!toolId) return [];
		return [
			{
				type: "tool_execution_update",
				toolCallId: toolId,
				toolName: meta.name,
				args: meta.args,
				partialResult: {
					content: [{ type: "text", text: preview || "" }],
					isError: false,
				},
			},
		];
	}

	private onToolEnd(id: string, name: string, summary?: string, error?: string): MappedAgentSessionEvent[] {
		const toolId = id || this.lastToolId || `tool_${this.toolMeta.size + 1}`;
		const meta = this.toolMeta.get(toolId) || { name, args: {} };
		const isError = !!error;
		const text = error || summary || "";
		const result = {
			content: [{ type: "text", text }],
			isError,
		};
		this.toolResults.push({
			role: "toolResult",
			toolCallId: toolId,
			toolName: meta.name || name,
			content: [{ type: "text", text }],
			isError,
			timestamp: Date.now(),
		});
		this.toolMeta.delete(toolId);
		return [
			{
				type: "tool_execution_end",
				toolCallId: toolId,
				toolName: meta.name || name,
				result,
				isError,
			},
		];
	}

	private finishTurn(usage?: Usage, reason: "stop" | "error" | "aborted" = "stop", errText?: string): MappedAgentSessionEvent[] {
		if (!this.agentOpen && !this.turnOpen && !this.messageOpen) {
			if (reason === "error" && errText) {
				return [{ type: "notice", level: "error", message: errText, source: "hermes-gateway" }];
			}
			return [];
		}
		const out: MappedAgentSessionEvent[] = [];
		out.push(...this.closeThinking());
		out.push(...this.closeText());

		const stopReason: MappedAssistantMessage["stopReason"] =
			reason === "error" ? "error" : reason === "aborted" ? "aborted" : this.toolResults.length ? "toolUse" : "stop";
		const msg = this.snapshot(stopReason, errText);
		msg.usage = applyGatewayUsage(usage);

		if (this.messageOpen) {
			if (reason === "error") {
				out.push({
					type: "message_update",
					message: msg,
					assistantMessageEvent: { type: "error", reason: "error", error: msg },
				});
			} else {
				out.push({
					type: "message_update",
					message: msg,
					assistantMessageEvent: {
						type: "done",
						reason: stopReason === "toolUse" ? "toolUse" : "stop",
						message: msg,
					},
				});
			}
			out.push({ type: "message_end", message: msg });
			this.messageOpen = false;
		}

		if (this.turnOpen) {
			out.push({ type: "turn_end", message: msg, toolResults: [...this.toolResults] });
			this.turnOpen = false;
		}

		if (this.agentOpen) {
			out.push({ type: "agent_end", messages: [msg] });
			this.agentOpen = false;
		}

		// reset turn accumulators
		this.content = [];
		this.toolResults = [];
		this.toolMeta.clear();
		this.textBuf = "";
		this.thinkingBuf = "";
		this.textIndex = null;
		this.thinkingIndex = null;
		this.lastToolId = "";
		return out;
	}

	/** Force-close open turn (interrupt / new user). */
	forceEnd(reason: "stop" | "aborted" | "error" = "aborted"): MappedAgentSessionEvent[] {
		return this.finishTurn(undefined, reason);
	}
}
