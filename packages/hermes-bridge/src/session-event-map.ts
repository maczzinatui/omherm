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
	| { type: "notice"; level: "info" | "warning" | "error"; message: string; source?: string }
	/** Transient OMP loader line (statusContainer) — never transcript. */
	| { type: "working_status"; message: string };

export type TurnMapperOptions = {
	model?: string;
	provider?: string;
};

/** Compact coat label for lean pipeline stages (S1). */
export function formatPipelineStage(ev: {
	stage: string
	open: boolean
	text: string
	iter?: number
	maxIter?: number
	ms?: number
	provider?: string
}): string {
	if (ev.stage === "summary") return ev.text
	const arrow = ev.open ? "▶" : "■"
	const bits = [`[lean] ${ev.stage} ${arrow}`]
	if (ev.ms != null && !ev.open) bits.push(`${Math.round(ev.ms)}ms`)
	if (ev.iter != null && ev.maxIter != null) bits.push(`${ev.iter}/${ev.maxIter}`)
	if (ev.provider) bits.push(ev.provider)
	return bits.join(" ")
}

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
	if (!raw) return {}
	try {
		const v = JSON.parse(raw)
		if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>
		return { input: v }
	} catch {
		// Human context line from gateway (`build_tool_label`) — surface as query/input.
		const s = raw.trim()
		if (!s) return {}
		// Common prefixes: "Searching …", "Reading https://…", "Running …"
		if (/^https?:\/\//i.test(s) || s.includes("://")) return { url: s, input: s }
		return { query: s, input: s }
	}
}

/**
 * Coerce Hermes tool args into the shapes stock OMP renderers expect
 * (bash wants `command`, read wants `path`/`file_path`, browser wants `action`+`url`, …).
 */
function normalizeHermesToolArgs(name: string, args: Record<string, unknown>): Record<string, unknown> {
	const a: Record<string, unknown> = { ...args }
	const str = (...keys: string[]): string | undefined => {
		for (const k of keys) {
			const v = a[k]
			if (typeof v === "string" && v.trim()) return v
		}
		return undefined
	}
	switch (name) {
		case "terminal":
		case "process": {
			const command = str("command", "cmd", "input", "query")
			if (command) a.command = command
			const cwd = str("cwd", "workdir", "working_directory")
			if (cwd) a.cwd = cwd
			break
		}
		case "execute_code": {
			const code = str("code", "input", "query", "source")
			if (code) a.code = code
			break
		}
		case "read_file": {
			const path = str("path", "file_path", "filename", "input", "query")
			if (path) {
				a.path = path
				a.file_path = path
			}
			break
		}
		case "write_file": {
			const path = str("path", "file_path", "filename", "input")
			if (path) {
				a.path = path
				a.file_path = path
			}
			const content = str("content", "text", "body")
			if (content) a.content = content
			break
		}
		case "search_files":
		case "grep": {
			const pattern = str("pattern", "query", "input", "regex")
			if (pattern) {
				a.pattern = pattern
				a.query = pattern
			}
			const path = str("path", "cwd", "directory")
			if (path) a.path = path
			break
		}
		case "web_search": {
			const query = str("query", "input", "q", "search")
			if (query) a.query = query
			break
		}
		case "web_extract":
		case "open_page": {
			const url = str("url", "input", "query")
			if (url) a.url = url
			break
		}
		case "browser_navigate": {
			const url = str("url", "input", "query")
			a.action = "open"
			if (url) a.url = url
			break
		}
		case "browser_click":
		case "browser_type":
		case "browser_press":
		case "browser_scroll":
		case "browser_snapshot":
		case "browser_vision":
		case "browser_console": {
			// OMP browser "run" cell — put a short label in code so the framed
			// cell has something to show even without CDP JS.
			a.action = a.action || "run"
			if (!str("code")) {
				const bits = [name.replace(/^browser_/, ""), str("ref", "element", "expression", "key", "direction", "question", "input")]
					.filter(Boolean)
					.join(" ")
				a.code = bits || name
			}
			break
		}
		case "patch": {
			const path = str("path", "file_path", "filename")
			if (path) a.path = path
			break
		}
		case "skill_view":
		case "skill_manage": {
			const name = str("name", "skill", "input", "query")
			if (name) a.name = name
			break
		}
		case "delegate_task": {
			const goal = str("goal", "input", "query", "title")
			if (goal) a.goal = goal
			break
		}
		case "computer_use": {
			const action = str("action", "input")
			if (action) a.action = action
			break
		}
		default:
			break
	}
	return a
}

function extractExitCode(raw: unknown): number | undefined {
	if (raw == null) return undefined
	if (typeof raw === "number" && Number.isFinite(raw)) return raw
	if (typeof raw !== "object") return undefined
	const o = raw as Record<string, unknown>
	for (const k of ["exit_code", "exitCode", "returncode", "status"]) {
		const v = o[k]
		if (typeof v === "number" && Number.isFinite(v)) return v
		if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return Number(v.trim())
	}
	// Nested process payload
	const nested = o.result ?? o.data
	if (nested && nested !== raw) return extractExitCode(nested)
	return undefined
}

function extractOutputText(raw: unknown): string {
	if (raw == null) return ""
	if (typeof raw === "string") return raw
	if (typeof raw !== "object") return String(raw)
	const o = raw as Record<string, unknown>
	for (const k of ["output", "stdout", "text", "content", "result_text", "message"]) {
		const v = o[k]
		if (typeof v === "string" && v.trim()) return v
	}
	if (typeof o.stderr === "string" && o.stderr.trim()) {
		const out = typeof o.stdout === "string" ? o.stdout : ""
		return out ? `${out}\n${o.stderr}` : o.stderr
	}
	try {
		const s = JSON.stringify(raw, null, 0)
		return s.length > 1200 ? s.slice(0, 1200) + "…" : s
	} catch {
		return String(raw)
	}
}

/**
 * Strip already-sealed assistant text prefixes from a new stream segment.
 * Gateway/models often re-emit the pre-tool preamble + new prose after tools
 * (or on message.complete), which OMP then paints as a second copy of the thought.
 * Returns null when the whole payload is a pure restate (drop).
 */
function novelTextRelativeToSealed(incoming: string, content: MappedContent[]): string | null {
	const raw = incoming ?? ""
	if (!raw.trim()) return ""
	const sealedParts = content
		.filter((c): c is Extract<MappedContent, { type: "text" }> => c.type === "text")
		.map((c) => c.text)
		.filter((t) => t.trim().length > 0)
	if (sealedParts.length === 0) return raw

	let rest = raw
	for (const part of sealedParts) {
		if (rest.startsWith(part)) {
			rest = rest.slice(part.length).replace(/^\s*\n?/, "")
			continue
		}
		// Trim-end prefix (trailing newline drift)
		const pe = part.replace(/\s+$/, "")
		if (pe && rest.startsWith(pe)) {
			rest = rest.slice(pe.length).replace(/^\s*\n?/, "")
			continue
		}
	}
	const sealedJoin = sealedParts.join("")
	if (!rest.trim()) {
		// Fully consumed by prefixes → pure restate
		return null
	}
	if (nearDupBody(rest, sealedJoin) && rest.trim().length <= sealedJoin.trim().length * 1.1) {
		return null
	}
	// If we couldn't strip but whole blob near-dups sealed join, drop
	if (nearDupBody(raw, sealedJoin) && raw.trim().length <= sealedJoin.trim().length * 1.15) {
		return null
	}
	return rest
}

/** Herm turnReducer.sameText — trim equality for complete vs streamed. */
function sameText(a: string, b: string): boolean {
	return a.trim() === b.trim()
}

function joinMappedText(content: MappedContent[]): string {
	return content
		.filter((c): c is Extract<MappedContent, { type: "text" }> => c.type === "text")
		.map((c) => c.text)
		.join("")
}

/**
 * Near-duplicate body check — gateway often re-emits the assistant answer as
 * reasoning.available / interim / complete after the stream already painted it.
 * Also catches thinking that is just the answer restated (MiniMax etc.).
 */
function nearDupBody(a: string, b: string): boolean {
	const x = a.trim()
	const y = b.trim()
	if (!x || !y) return false
	if (sameText(x, y)) return true
	// Substantial containment either way (avoid tiny status crumbs matching)
	if (x.length >= 40 && y.length >= 40) {
		if (x.includes(y) || y.includes(x)) return true
		// Same start + similar length (whitespace / trailing punctuation drift)
		const n = Math.min(80, x.length, y.length)
		if (n >= 40 && x.slice(0, n) === y.slice(0, n)) {
			const ratio = Math.max(x.length, y.length) / Math.min(x.length, y.length)
			if (ratio <= 1.2) return true
		}
	}
	return false
}

/**
 * Remove reasoning/CoT that leaked into assistant text (MiniMax often puts
 * last_reasoning both on message.complete.reasoning AND inside text).
 */
function stripReasoningOverlap(text: string, reasoning: string): string {
	if (!text?.trim() || !reasoning?.trim()) return text ?? ""
	const r = reasoning.trim()
	const original = text
	// Identical → keep answer; thinking side is dropped by caller.
	if (sameText(text, r)) return original
	let t = text
	if (t.includes(r) && t.trim() !== r) {
		t = t.split(r).join("")
	} else {
		const tt = t.trimEnd()
		const rt = r
		if (tt.endsWith(rt) && tt.length > rt.length) t = tt.slice(0, -rt.length)
		else if (tt.startsWith(rt) && tt.length > rt.length) t = tt.slice(rt.length)
		else {
			// Near-dup but not exact: keep text (prefer user-visible answer).
			if (nearDupBody(tt, rt)) return original
			const n = Math.min(120, tt.length, rt.length)
			if (
				n >= 60 &&
				tt.slice(0, n) === rt.slice(0, n) &&
				rt.length >= tt.length * 1.5
			) {
				return ""
			}
		}
	}
	return t.replace(/\n{3,}/g, "\n\n").replace(/[ 	]+\n/g, "\n").trim()
}

function stripAllThinkingFromText(
	text: string,
	content: MappedContent[],
	thinkingBuf: string,
): string {
	let t = text
	const blobs = [
		thinkingBuf,
		...content.filter((c): c is Extract<MappedContent, { type: "thinking" }> => c.type === "thinking").map((c) => c.thinking),
	].filter((s) => (s || "").trim().length >= 24)
	// Longest first so nested copies strip cleanly
	blobs.sort((a, b) => b.length - a.length)
	for (const b of blobs) t = stripReasoningOverlap(t, b)
	return t
}

/**
 * Drop thinking that restates assistant text; merge consecutive identical text
 * blocks. Prevents OMP painting bright text + dim thinking twins (and dual
 * text blocks that settle into native scrollback as ghost doubles).
 */
function collapseMappedContent(content: MappedContent[]): MappedContent[] {
	const textJoined = joinMappedText(content)
	const out: MappedContent[] = []
	for (const c of content) {
		if (c.type === "thinking") {
			if (nearDupBody(c.thinking, textJoined)) continue
			if (!c.thinking.trim()) continue
			const prev = out[out.length - 1]
			if (prev?.type === "thinking" && nearDupBody(prev.thinking, c.thinking)) {
				// keep longer
				if (c.thinking.length > prev.thinking.length) prev.thinking = c.thinking
				continue
			}
			out.push({ ...c })
			continue
		}
		if (c.type === "text") {
			if (!c.text.trim()) continue
			const prev = out[out.length - 1]
			if (prev?.type === "text" && nearDupBody(prev.text, c.text)) {
				if (c.text.length > prev.text.length) prev.text = c.text
				continue
			}
			out.push({ ...c })
			continue
		}
		out.push({ ...c })
	}
	return out
}

/** Pull list-like hits from common Hermes/Firecrawl-ish web_search JSON shapes. */
function extractWebHits(raw: unknown): Array<{ title: string; url: string; snippet?: string }> {
	if (!raw || typeof raw !== "object") return []
	const r = raw as Record<string, unknown>
	const candidates: unknown[] = []
	const data = r.data
	if (data && typeof data === "object") {
		const d = data as Record<string, unknown>
		if (Array.isArray(d.web)) candidates.push(...d.web)
		if (Array.isArray(d.results)) candidates.push(...d.results)
	}
	if (Array.isArray(r.web)) candidates.push(...r.web)
	if (Array.isArray(r.results)) candidates.push(...r.results)
	if (Array.isArray(r.sources)) candidates.push(...r.sources)
	const out: Array<{ title: string; url: string; snippet?: string }> = []
	for (const item of candidates) {
		if (!item || typeof item !== "object") continue
		const o = item as Record<string, unknown>
		const url = String(o.url || o.link || o.href || "").trim()
		const title = String(o.title || o.name || url || "source").trim()
		const snippet = String(o.description || o.snippet || o.content || o.text || "").trim()
		if (!url && !title) continue
		out.push({ title, url, snippet: snippet || undefined })
	}
	return out
}

/**
 * Build OMP tool result payload. Named Hermes tools get the details shape
 * stock OMP renderers need so black-box / framed chrome paints instead of
 * empty "Response / No response data" / bare (no output) rows.
 */
function paintToolResult(
	name: string,
	summary?: string,
	error?: string,
	rawResult?: unknown,
): {
	content: Array<{ type: "text"; text: string }>
	details?: unknown
} {
	if (error) {
		return { content: [{ type: "text", text: error }] }
	}
	const hits = name === "web_search" || name === "web_extract" ? extractWebHits(rawResult) : []
	if (name === "web_search") {
		const answer =
			(summary || "").trim() ||
			(hits.length > 0 ? `Did ${hits.length} search${hits.length === 1 ? "" : "es"}` : "")
		// Always attach OMP SearchResponse details so web_search uses framed chrome
		// instead of the "Response / No response data" fallback path.
		return {
			content: [{ type: "text", text: answer || "Web search" }],
			details: {
				response: {
					provider: "none" as const,
					answer: answer || undefined,
					sources: hits.map((h) => ({
						title: h.title,
						url: h.url,
						snippet: h.snippet,
					})),
					searchQueries: [],
				},
			},
		}
	}
	if (name === "web_extract" || name === "open_page") {
		const text =
			(summary || "").trim() ||
			extractOutputText(rawResult) ||
			(hits.length > 0
				? hits
						.slice(0, 5)
						.map((h) => (h.url ? `${h.title} — ${h.url}` : h.title))
						.join("\n")
				: "")
		if (hits.length > 0) {
			return {
				content: [{ type: "text", text: text || "Extracted" }],
				details: {
					response: {
						provider: "none" as const,
						answer: text || undefined,
						sources: hits.map((h) => ({
							title: h.title,
							url: h.url,
							snippet: h.snippet,
						})),
						searchQueries: [],
					},
				},
			}
		}
		return { content: [{ type: "text", text: text || "" }] }
	}
	if (name === "terminal" || name === "process") {
		const text = (summary || "").trim() || extractOutputText(rawResult)
		const exitCode = extractExitCode(rawResult)
		const details: Record<string, unknown> = {}
		if (exitCode !== undefined) details.exitCode = exitCode
		return {
			content: [{ type: "text", text: text || (exitCode === 0 ? "" : text) }],
			details: Object.keys(details).length ? details : undefined,
		}
	}
	if (name === "execute_code") {
		const text = (summary || "").trim() || extractOutputText(rawResult)
		return { content: [{ type: "text", text: text || "" }] }
	}
	if (name === "read_file") {
		const text = (summary || "").trim() || extractOutputText(rawResult)
		return { content: [{ type: "text", text: text || "" }] }
	}
	if (name.startsWith("browser_")) {
		const text = (summary || "").trim() || extractOutputText(rawResult)
		const url =
			rawResult && typeof rawResult === "object"
				? String((rawResult as Record<string, unknown>).url || "").trim()
				: ""
		return {
			content: [{ type: "text", text: text || "" }],
			details: {
				url: url || undefined,
				name: "main",
				browser: "connected" as const,
			},
		}
	}
	// Prefer gateway summary ("Did 5 searches in 0.8s"); then short raw dump.
	let text = (summary || "").trim()
	if (!text && rawResult != null) {
		text = extractOutputText(rawResult)
	}
	if (!text && hits.length > 0) {
		text = hits
			.slice(0, 5)
			.map((h) => (h.url ? `${h.title} — ${h.url}` : h.title))
			.join("\n")
	}
	return { content: [{ type: "text", text: text || "" }] }
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

	/** Last reasoning_effort from session.info (paint path for coat footer). */
	reasoningEffort?: string;

	setIdentity(model?: string, provider?: string, reasoningEffort?: string) {
		if (model) this.model = model;
		if (provider) this.provider = provider;
		if (reasoningEffort !== undefined && reasoningEffort !== null && reasoningEffort !== "") {
			this.reasoningEffort = String(reasoningEffort);
		}
	}

	private snapshot(stopReason: MappedAssistantMessage["stopReason"] = "stop", err?: string): MappedAssistantMessage {
		return {
			role: "assistant",
			content: collapseMappedContent(this.content).map((c) => structuredClone(c)),
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
			if (this.textIndex === null) return []
			const idx = this.textIndex
			const content = this.textBuf
			this.textIndex = null
			// Keep sealed text in content[]; clear stream cursor only (Herm seal).
			// textBuf stays until a new segment opens so complete-only de-dupe can see it.
			const msg = this.snapshot()
			return [
				{
					type: "message_update",
					message: msg,
					assistantMessageEvent: { type: "text_end", contentIndex: idx, content, partial: msg },
				},
			]
		}

	/** Feed one UiEvent; returns zero or more mapped OMP events. */
	feedUi(ev: UiEvent): MappedAgentSessionEvent[] {
		switch (ev.kind) {
			case "info":
				this.setIdentity(ev.info.model, ev.info.provider, ev.info.reasoning_effort);
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
				return this.onToolEnd(ev.id, ev.name, ev.summary, ev.error, ev.result);
			case "turn_end":
				return this.finishTurn(ev.usage, "stop");
			case "error":
				return this.finishTurn(undefined, "error", ev.text);
			case "status":
				return [{ type: "working_status", message: ev.text }];
			case "pipeline_stage": {
				// S1: dense working rail for stages; notice only for summary / policy
				const label = formatPipelineStage(ev)
				const out: MappedAgentSessionEvent[] = [
					{ type: "working_status", message: label },
				]
				if (ev.stage === "summary" || ev.stage === "policy" || (!ev.open && ev.stage === "egress")) {
					out.push({
						type: "notice",
						level: "info",
						message: label,
						source: "lean-pipeline",
					})
				}
				return out
			}
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
			case "lifecycle":
				// Durable system-ish line without killing the turn.
				// lean-pipeline lines are usually remapped to pipeline_stage upstream;
				// if they land here raw, still surface densely.
				if (ev.text.includes("[lean-pipeline]")) {
					return [
						{ type: "working_status", message: ev.text },
						{
							type: "notice",
							level: "info",
							message: ev.text,
							source: "lean-pipeline",
						},
					]
				}
				return [
					{ type: "working_status", message: ev.text },
					{ type: "notice", level: "info", message: ev.text, source: "hermes-gateway" },
				]
			// ===== P2 mapper gap: surface as notices / working_status only =====
			case "subagent_start": {
				const label = ev.preview || ev.goal || ev.subagentId || "subagent"
				return [
					{
						type: "notice",
						level: "info",
						message: `subagent ${ev.subagentId || ""} start: ${label}`,
						source: "subagent",
					},
				]
			}
			case "subagent_text":
				// Streamed child text — drop from main transcript (no subagent transcript
				// in OMP today); keep a transient working_status so operator sees activity.
				return ev.text
					? [{ type: "working_status", message: `subagent: ${ev.text}` }]
					: []
			case "subagent_thinking":
				return []
			case "subagent_tool":
				return [
					{
						type: "working_status",
						message: `subagent tool: ${ev.tool || "?"}${ev.preview ? ` — ${ev.preview.slice(0, 80)}` : ""}`,
					},
				]
			case "subagent_complete":
				return [
					{
						type: "notice",
						level: "info",
						message: `subagent ${ev.subagentId || ""} done: ${ev.preview || ev.resultText || "(no preview)"}`.slice(0, 240),
						source: "subagent",
					},
				]
			case "review_summary":
				return ev.text
					? [
							{
								type: "notice",
								level: "info",
								message: `review: ${ev.text}`.slice(0, 240),
								source: "review",
							},
						]
					: []
			case "browser_progress":
				return ev.message
					? [
							{
								type: "working_status",
								message: `browser: ${ev.message}`,
							},
						]
					: []
			case "moa_reference":
				return ev.url
					? [
							{
								type: "notice",
								level: "info",
								message: `moa ref: ${ev.title || ev.url}`.slice(0, 200),
								source: "moa",
							},
						]
					: []
			case "moa_aggregating":
				return [
					{
						type: "working_status",
						message: `moa aggregating: ${ev.aggregator || "..."}`,
					},
				]
			case "background_complete":
				return [
					{
						type: "notice",
						level: "info",
						message: `background ${ev.taskId || ""} done: ${ev.text || "(no text)"}`.slice(0, 240),
						source: "background",
					},
				]
			case "skin_changed":
				return [
					{
						type: "notice",
						level: "info",
						message: `skin: ${ev.skin || "(none)"}`,
						source: "skin",
					},
				]
			case "terminal_close":
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
		// Do not close open text for reasoning crumbs — Herm keeps parts ordered;
		// closing text mid-answer then reopening causes dual text blocks.
		// Only close text when we will actually keep a distinct thinking block.
		const sealedText = joinMappedText(this.content)
		const openText = this.textIndex !== null ? this.textBuf : ""
		const answerSoFar = openText || sealedText

		// Herm upsertThinking: `final` (reasoning.available) keeps accumulated
		// buffer if non-empty; only use payload when buffer empty.
		let nextBuf: string
		if (done) {
			nextBuf = (this.thinkingBuf.trim() ? this.thinkingBuf : text) || this.thinkingBuf || text || ""
		} else {
			// Cumulative full-buffer vs token delta (same as text path)
			if (text && this.thinkingBuf && text.startsWith(this.thinkingBuf) && text.length >= this.thinkingBuf.length) {
				nextBuf = text
			} else {
				nextBuf = this.thinkingBuf + (text || "")
			}
		}

		// Drop reasoning that is just the assistant answer restated (bright+dim twin).
		if (nearDupBody(nextBuf, answerSoFar)) {
			// If we already opened a thinking block that now matches answer, strip it.
			if (this.thinkingIndex !== null) {
				const idx = this.thinkingIndex
				this.thinkingIndex = null
				this.thinkingBuf = ""
				if (this.content[idx]?.type === "thinking") this.content.splice(idx, 1)
				// Re-index text if it sat after removed thinking
				if (this.textIndex !== null && this.textIndex > idx) this.textIndex -= 1
			}
			// Still scrub CoT out of answer text if it leaked there
			this.#scrubThinkingFromAllText(nextBuf)
			return out
		}

		// Scrub this CoT out of any already-streamed answer text (late reasoning.*)
		this.#scrubThinkingFromAllText(nextBuf)

		out.push(...this.closeText())

		// Herm upsertThinking: insert thinking at the FRONT so it paints above
		// the answer — never as a trailing twin after the user-visible reply.
		if (this.thinkingIndex === null) {
			this.content.unshift({ type: "thinking", thinking: "" })
			this.thinkingIndex = 0
			if (this.textIndex !== null) this.textIndex += 1
			this.thinkingBuf = ""
			const msg = this.snapshot()
			out.push({
				type: "message_update",
				message: msg,
				assistantMessageEvent: { type: "thinking_start", contentIndex: this.thinkingIndex, partial: msg },
			})
		}

		this.thinkingBuf = nextBuf
		const block = this.content[this.thinkingIndex!]
		if (block?.type === "thinking") block.thinking = this.thinkingBuf

		const msg = this.snapshot()
		out.push({
			type: "message_update",
			message: msg,
			assistantMessageEvent: {
				type: "thinking_delta",
				contentIndex: this.thinkingIndex!,
				delta: done ? "" : text,
				partial: msg,
			},
		})
		if (done) out.push(...this.closeThinking())
		return out
	}

	private onText(text: string, done?: boolean): MappedAgentSessionEvent[] {
		const out = this.ensureAgentTurn()
		out.push(...this.closeThinking())

		// Herm turnReducer.finalize for message.complete — never double-append final.
		if (done) {
			const joined = joinMappedText(this.content)
			const open = this.textIndex !== null ? this.textBuf : ""
			let final = (text && text.length ? text : open) || ""

			// Strip any CoT that landed in the answer channel
			final = stripAllThinkingFromText(final, this.content, this.thinkingBuf)

			// Complete often restates sealed pre-tool text + open segment.
			if (this.textIndex === null) {
				const novel = novelTextRelativeToSealed(final, this.content)
				if (novel === null) {
					this.#stripThinkingDupingText(joined || final)
					return out
				}
				final = novel
			} else {
				// Open segment: strip sealed (not including open buffer) from final
				const sealedOnly = this.content.filter(
					(c, i) => c.type === "text" && i !== this.textIndex,
				)
				const novel = novelTextRelativeToSealed(final, sealedOnly)
				if (novel === null) {
					// final is only sealed — keep open buffer
					final = open
				} else if (novel && open && novel.startsWith(open)) {
					// novel is open + more, or just open extended
					final = novel
				} else if (novel && open && nearDupBody(novel, open)) {
					final = open.length >= novel.length ? open : novel
				} else if (novel) {
					final = novel
				}
			}

			const dupPart =
				!!final && this.content.some((c) => c.type === "text" && nearDupBody(c.text, final))
			const dupJoin = !!final && (nearDupBody(joined, final) || (!!open && nearDupBody(open, final)))

			if (this.textIndex !== null) {
				// Seal open stream. Take final only when it extends the open buffer
				// (cumulative complete) or open is empty; never replace with a shorter restate.
				if (final) {
					if (!this.textBuf.trim()) {
						this.textBuf = final
					} else if (final.startsWith(this.textBuf) && final.length > this.textBuf.length) {
						this.textBuf = final
					} else if (sameText(this.textBuf, final) || dupJoin || dupPart || nearDupBody(this.textBuf, final)) {
						// keep streamed buffer
					} else if (this.textBuf.startsWith(final)) {
						// complete is a prefix of stream — keep longer stream
					} else {
						// Prefer novel final when it does not reintroduce sealed preamble
						if (final.length > this.textBuf.length) this.textBuf = final
					}
				}
				const block = this.content[this.textIndex]
				if (block?.type === "text") {
					// Final scrub: never leave reasoning residue in sealed text
					this.textBuf = stripAllThinkingFromText(this.textBuf, this.content, this.thinkingBuf)
					block.text = this.textBuf
				}
				// Strip thinking that restates this answer
				this.#stripThinkingDupingText(this.textBuf)
				out.push(...this.closeText())
				return out
			}

			// No open stream: append final only if not already present (Herm finalize).
			const sealed = joinMappedText(this.content)
			final = stripAllThinkingFromText(final, this.content, this.thinkingBuf)
			if (!final.trim() || dupPart || dupJoin || nearDupBody(sealed, final)) {
				this.#stripThinkingDupingText(sealed || final)
				return out
			}
			this.textIndex = this.content.length
			this.textBuf = final
			this.content.push({ type: "text", text: final })
			this.#stripThinkingDupingText(final)
			const msg = this.snapshot()
			out.push({
				type: "message_update",
				message: msg,
				assistantMessageEvent: { type: "text_start", contentIndex: this.textIndex, partial: msg },
			})
			out.push({
				type: "message_update",
				message: msg,
				assistantMessageEvent: {
					type: "text_delta",
					contentIndex: this.textIndex,
					delta: final,
					partial: msg,
				},
			})
			out.push(...this.closeText())
			return out
		}

		// Streaming deltas (message.delta)
		// Skip empty message.start ticks that would open a useless block.
		if (!text && this.textIndex === null) {
			return out
		}

		// New segment after seal: strip re-emitted preamble; drop pure restates.
		if (this.textIndex === null) {
			const novel = text ? novelTextRelativeToSealed(text, this.content) : text
			if (novel === null) {
				return out
			}
			if (novel !== text) {
				// Continue with stripped body
				text = novel
			}
			if (!text && this.textIndex === null) {
				return out
			}
			this.textIndex = this.content.length
			this.textBuf = ""
			this.content.push({ type: "text", text: "" })
			const msg = this.snapshot()
			out.push({
				type: "message_update",
				message: msg,
				assistantMessageEvent: { type: "text_start", contentIndex: this.textIndex, partial: msg },
			})
		}

		// Cumulative full-buffer ticks vs true token deltas
		let delta = text
		if (text && this.textBuf && text.startsWith(this.textBuf) && text.length >= this.textBuf.length) {
			delta = text.slice(this.textBuf.length)
			this.textBuf = text
		} else if (
			text &&
			this.textBuf &&
			this.textBuf.startsWith(text) &&
			text.length < this.textBuf.length
		) {
			// Retransmit of a shorter prefix — ignore
			delta = ""
		} else {
			// Token delta OR cumulative that includes sealed+open (cross-segment)
			const sealedOnly = this.content.filter((c, i) => c.type === "text" && i !== this.textIndex)
			const maybe = text ? novelTextRelativeToSealed(text, sealedOnly) : text
			if (maybe === null) {
				delta = ""
			} else if (maybe !== text && this.textBuf && maybe.startsWith(this.textBuf)) {
				delta = maybe.slice(this.textBuf.length)
				this.textBuf = maybe
			} else if (maybe !== text && !this.textBuf) {
				delta = maybe
				this.textBuf = maybe
			} else {
				this.textBuf += text
			}
		}
		const block = this.content[this.textIndex!]
		if (block?.type === "text") block.text = this.textBuf
		// Live-strip thinking twins as answer grows
		this.#stripThinkingDupingText(this.textBuf)
		if (!delta && !text) {
			// still emit snapshot if we only stripped thinking
			const msgOnly = this.snapshot()
			out.push({
				type: "message_update",
				message: msgOnly,
				assistantMessageEvent: {
					type: "text_delta",
					contentIndex: this.textIndex!,
					delta: "",
					partial: msgOnly,
				},
			})
			return out
		}
		const msg = this.snapshot()
		out.push({
			type: "message_update",
			message: msg,
			assistantMessageEvent: {
				type: "text_delta",
				contentIndex: this.textIndex!,
				delta,
				partial: msg,
			},
		})
		return out
	}

	/** Remove thinking blocks that near-duplicate assistant text (in-place). */
	#stripThinkingDupingText(answer: string): void {
		if (!answer.trim()) return
		for (let i = this.content.length - 1; i >= 0; i--) {
			const c = this.content[i]
			if (c?.type !== "thinking") continue
			if (!nearDupBody(c.thinking, answer)) continue
			this.content.splice(i, 1)
			if (this.thinkingIndex === i) {
				this.thinkingIndex = null
				this.thinkingBuf = ""
			} else if (this.thinkingIndex !== null && this.thinkingIndex > i) {
				this.thinkingIndex -= 1
			}
			if (this.textIndex !== null && this.textIndex > i) this.textIndex -= 1
		}
	}

	/** Pull CoT blobs out of every text block (and open textBuf). */
	#scrubThinkingFromAllText(reasoning: string): void {
		if (!reasoning?.trim()) return
		for (const c of this.content) {
			if (c.type === "text") c.text = stripReasoningOverlap(c.text, reasoning)
		}
		if (this.textBuf) {
			this.textBuf = stripReasoningOverlap(this.textBuf, reasoning)
			if (this.textIndex !== null) {
				const b = this.content[this.textIndex]
				if (b?.type === "text") b.text = this.textBuf
			}
		}
	}

	private onToolStart(id: string, name: string, argsText?: string): MappedAgentSessionEvent[] {
		const out = this.ensureAgentTurn()
		out.push(...this.closeThinking())
		out.push(...this.closeText())
		// Clean stream cursor so next text is a new part (Herm appendPart close=true).
		this.textBuf = ""
		const args = normalizeHermesToolArgs(name, parseArgs(argsText))
		const toolId = (id && String(id).trim()) || `tool_${this.toolMeta.size + 1}`
		// De-dupe duplicate tool.start for same id
		if (this.toolMeta.has(toolId)) {
			this.lastToolId = toolId
			const prev = this.toolMeta.get(toolId)!
			if (argsText) {
				this.toolMeta.set(toolId, {
					name: name || prev.name,
					args: Object.keys(args).length ? args : prev.args,
				})
			}
			return out
		}
		this.lastToolId = toolId
		this.toolMeta.set(toolId, { name, args })
		this.content.push({ type: "toolCall", id: toolId, name, arguments: args })
		out.push({ type: "tool_execution_start", toolCallId: toolId, toolName: name, args })
		return out
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

	private onToolEnd(
		id: string,
		name: string,
		summary?: string,
		error?: string,
		rawResult?: unknown,
	): MappedAgentSessionEvent[] {
		const toolId = id || this.lastToolId || `tool_${this.toolMeta.size + 1}`
		const meta = this.toolMeta.get(toolId) || { name, args: {} }
		const isError = !!error
		const toolName = meta.name || name
		const painted = paintToolResult(toolName, summary, error, rawResult)
		const text = painted.content[0]?.text || ""
		const result = {
			content: painted.content,
			details: painted.details,
			isError,
		}
		this.toolResults.push({
			role: "toolResult",
			toolCallId: toolId,
			toolName,
			content: [{ type: "text", text }],
			isError,
			timestamp: Date.now(),
		})
		this.toolMeta.delete(toolId)
		return [
			{
				type: "tool_execution_end",
				toolCallId: toolId,
				toolName,
				result,
				isError,
			},
		]
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
