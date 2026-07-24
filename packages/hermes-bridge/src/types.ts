// Hermes tui_gateway event + RPC types (client view).

export type Usage = {
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
  cost_usd?: number
  context_used?: number
  context_max?: number
  context_percent?: number
  compressions?: number
}

export type SessionInfo = {
  model?: string
  provider?: string
  reasoning_effort?: string
  cwd?: string
  branch?: string
  session_id?: string
  stored_session_id?: string
  tools?: Record<string, string[]>
  skills?: Record<string, string[]>
  usage?: Usage
  title?: string
  profile_name?: string
  running?: boolean
  yolo?: boolean
}

export type SessionCreateResponse = {
  session_id: string
  info?: SessionInfo
}

export type GatewayEvent =
  | { type: "gateway.ready"; payload?: unknown }
  | { type: "gateway.stderr"; payload: { line: string } }
  | { type: "gateway.start_timeout"; payload?: { cwd?: string; python?: string } }
  | { type: "gateway.protocol_error"; payload?: { preview?: string } }
  | { type: "session.info"; payload: SessionInfo }
  | { type: "session.title"; payload: { session_id?: string; title?: string } }
  | { type: "message.start"; payload?: undefined }
  | { type: "message.delta"; payload?: { text?: string } }
  | {
      type: "message.complete"
      payload?: {
        text?: string | null
        status?: "complete" | "error" | "interrupted"
        usage?: Usage
        reasoning?: string
      }
    }
  | { type: "thinking.delta"; payload?: { text?: string } }
  | { type: "reasoning.delta"; payload?: { text?: string } }
  | { type: "reasoning.available"; payload?: { text?: string } }
  | { type: "status.update"; payload?: { text?: string; kind?: string } }
  | { type: "message.interim"; payload?: { text?: string; already_streamed?: boolean } }
  | {
      type: "tool.start"
      payload: { tool_id: string; name?: string; args_text?: string; context?: string }
    }
  | { type: "tool.progress"; payload: { name?: string; preview?: string } }
  | { type: "tool.generating"; payload: { name?: string } }
  | {
      type: "tool.complete"
      payload: {
        tool_id: string
        name?: string
        summary?: string
        error?: string
        duration_s?: number
        result_text?: string
        /** Parsed tool return (gateway always sets when JSON). */
        result?: unknown
        args?: unknown
      }
    }
  | {
      type: "clarify.request"
      payload: { request_id: string; question: string; choices: string[] | null }
    }
  | {
      type: "approval.request"
      payload: { command: string; description: string }
    }
  | { type: "error"; payload?: { message?: string } }

const KNOWN = new Set([
  "gateway.ready",
  "gateway.stderr",
  "gateway.start_timeout",
  "gateway.protocol_error",
  "session.info",
  "session.title",
  "message.start",
  "message.delta",
  "message.complete",
  "message.interim",
  "thinking.delta",
  "reasoning.delta",
  "reasoning.available",
  "status.update",
  "tool.start",
  "tool.progress",
  "tool.generating",
  "tool.complete",
  "clarify.request",
  "approval.request",
  "error",
])

export function asGatewayEvent(v: unknown): GatewayEvent | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null
  const t = (v as { type?: unknown }).type
  if (typeof t !== "string" || !KNOWN.has(t)) return null
  return v as GatewayEvent
}

/** Drop last_reasoning when it was also stuffed into final_response text. */
function stripReasoningFromCompleteText(text: string, reasoning: string): string {
  if (!text?.trim() || !reasoning?.trim()) return text ?? ""
  const r = reasoning.trim()
  if (text.trim() === r) return text // identical: keep; UI prefers text over empty
  let t = text
  if (t.includes(r) && t.trim() !== r) t = t.split(r).join("")
  else {
    const tt = t.trimEnd()
    if (tt.endsWith(r) && tt.length > r.length) t = tt.slice(0, -r.length)
    else if (tt.startsWith(r) && tt.length > r.length) t = tt.slice(r.length)
  }
  return t.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim()
}

/** UI-facing events after mapping (OMP chrome host consumes these). */
export type UiEvent =
  | { kind: "ready" }
  | { kind: "info"; info: SessionInfo }
  | { kind: "stderr"; line: string }
  | { kind: "status"; text: string }
  | { kind: "lifecycle"; text: string }
  | { kind: "user"; text: string }
  | { kind: "thinking"; text: string; done?: boolean }
  | { kind: "text"; text: string; done?: boolean }
  | { kind: "tool_start"; id: string; name: string; args?: string }
  | { kind: "tool_update"; id: string; preview?: string }
  | {
      kind: "tool_end"
      id: string
      name: string
      summary?: string
      error?: string
      /** Raw gateway result (object or string) for OMP-shaped details. */
      result?: unknown
    }
  | { kind: "error"; text: string }
  | { kind: "clarify"; id: string; question: string; choices: string[] | null }
  | {
      kind: "approval"
      command: string
      description: string
      /** once|session|always|deny — gateway default set when missing */
      choices?: string[]
      pattern_keys?: string[]
      smart_denied?: boolean
    }
  | { kind: "turn_end"; usage?: Usage }

export function mapGatewayToUi(ev: GatewayEvent): UiEvent | UiEvent[] | null {
  switch (ev.type) {
    case "gateway.ready":
      return { kind: "ready" }
    case "gateway.stderr":
      return { kind: "stderr", line: ev.payload.line }
    case "gateway.start_timeout":
      return { kind: "error", text: "gateway start timeout" }
    case "gateway.protocol_error":
      return { kind: "error", text: `protocol: ${ev.payload?.preview ?? "?"}` }
    case "session.info":
      return { kind: "info", info: ev.payload }
    case "status.update": {
      // Herm events.ts: process/status = transient coat status only;
      // lifecycle/error/warn also leave a durable notice (not error — error ends turns).
      const text = (ev.payload?.text ?? "").trim()
      if (!text) return null
      const kind = (ev.payload as { kind?: string } | undefined)?.kind
      if (!kind || kind === "status" || kind === "process") {
        return { kind: "status", text }
      }
      return { kind: "lifecycle", text }
    }
    case "thinking.delta":
      // Cosmetic spinner / kaomoji from Hermes — NOT model reasoning.
      // Herm: status-only. Never paint into transcript thinking blocks.
      return ev.payload?.text ? { kind: "status", text: ev.payload.text } : null
    case "reasoning.delta":
      return ev.payload?.text ? { kind: "thinking", text: ev.payload.text } : null
    case "reasoning.available":
      return ev.payload?.text ? { kind: "thinking", text: ev.payload.text, done: true } : null
    case "message.start":
      return { kind: "text", text: "" }
    case "message.delta":
      return ev.payload?.text != null ? { kind: "text", text: ev.payload.text } : null
    case "message.interim": {
      // Mid-turn commentary. If already_streamed, skip (gateway already sent deltas).
      const p = ev.payload as { text?: string; already_streamed?: boolean } | undefined
      if (p?.already_streamed || !p?.text?.trim()) return null
      return { kind: "text", text: p.text, done: true }
    }
    case "message.complete": {
      const out: UiEvent[] = []
      const p = ev.payload
      if (p?.status === "error") {
        out.push({ kind: "error", text: p.text || "request failed" })
        out.push({ kind: "turn_end", usage: p?.usage })
        return out
      }
      // Gateway attaches last_reasoning separately; also strip it out of text
      // when the model double-stuffed CoT into final_response (MiniMax etc.).
      const reasoning = typeof p?.reasoning === "string" ? p.reasoning.trim() : ""
      let text = typeof p?.text === "string" ? p.text : p?.text == null ? "" : String(p.text)
      if (reasoning) {
        out.push({ kind: "thinking", text: reasoning, done: true })
        text = stripReasoningFromCompleteText(text, reasoning)
      }
      if (p?.status === "interrupted" && text) {
        text = text.endsWith("*[interrupted]*") ? text : `${text}\n\n*[interrupted]*`
      }
      out.push({ kind: "text", text, done: true })
      out.push({ kind: "turn_end", usage: p?.usage })
      return out
    }
    case "tool.start":
      return {
        kind: "tool_start",
        id: ev.payload.tool_id,
        name: ev.payload.name || "tool",
        args: ev.payload.args_text || ev.payload.context,
      }
    case "tool.progress":
    case "tool.generating":
      return { kind: "tool_update", id: "", preview: (ev.payload as { preview?: string }).preview }
    case "tool.complete": {
      const p = ev.payload as {
        tool_id?: string
        name?: string
        summary?: string
        error?: string
        result_text?: string
        result?: unknown
      }
      // Prefer human summary; fall back to result_text; keep raw result for OMP details.
      const summary =
        p.summary ||
        p.result_text ||
        (typeof p.result === "string" ? p.result : undefined)
      return {
        kind: "tool_end",
        id: p.tool_id || "",
        name: p.name || "tool",
        summary,
        error: p.error,
        result: p.result,
      }
    }
    case "clarify.request":
      return {
        kind: "clarify",
        id: ev.payload.request_id,
        question: ev.payload.question,
        choices: ev.payload.choices,
      }
    case "approval.request": {
      const p = ev.payload as {
        command?: string
        description?: string
        choices?: string[]
        pattern_keys?: string[]
        smart_denied?: boolean
        allow_permanent?: boolean
      }
      let choices = Array.isArray(p.choices) ? p.choices.map(String) : undefined
      if (!choices?.length) {
        if (p.smart_denied) choices = ["once", "deny"]
        else if (p.allow_permanent === false) choices = ["once", "session", "deny"]
        else if ("allow_permanent" in p) choices = ["once", "session", "always", "deny"]
        else choices = ["once", "session", "always", "deny"]
      }
      return {
        kind: "approval",
        command: String(p.command ?? ""),
        description: String(p.description ?? p.command ?? "Approval required"),
        choices,
        pattern_keys: p.pattern_keys,
        smart_denied: p.smart_denied,
      }
    }
    case "error":
      return { kind: "error", text: ev.payload?.message || "error" }
    default:
      return null
  }
}
