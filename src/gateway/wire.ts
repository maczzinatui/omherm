// Typed subset of Hermes tui_gateway JSON-RPC events.
// Protocol owned by hermes-agent; this file is a client view (not a fork of Herm).

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

export type GatewaySkin = {
  name?: string
  colors?: Record<string, string>
  branding?: Record<string, string>
}

export type SessionInfo = {
  model?: string
  cwd?: string
  session_id?: string
  tools?: Record<string, string[]>
  skills?: Record<string, string[]>
  version?: string
  system_prompt?: string
  usage?: Usage
  context_max?: number
  context_used?: number
  credential_warning?: string
  install_warning?: string
  running?: boolean
  yolo?: boolean
  title?: string
}

export type SessionCreateResponse = {
  session_id: string
  info?: SessionInfo
}

/** Known events only — unknown types stay outside this union so switch narrows. */
export type GatewayEvent =
  | { type: "gateway.ready"; payload?: { skin?: GatewaySkin }; session_id?: string }
  | { type: "gateway.stderr"; payload: { line: string }; session_id?: string }
  | { type: "gateway.start_timeout"; payload?: { cwd?: string; python?: string }; session_id?: string }
  | { type: "gateway.protocol_error"; payload?: { preview?: string }; session_id?: string }
  | { type: "session.info"; payload: SessionInfo; session_id?: string }
  | { type: "session.title"; payload: { session_id?: string; title?: string }; session_id?: string }
  | { type: "message.start"; payload?: undefined; session_id?: string }
  | { type: "message.delta"; payload?: { text?: string; rendered?: string }; session_id?: string }
  | {
      type: "message.complete"
      payload?: {
        text?: string | null
        rendered?: string
        reasoning?: string
        status?: "complete" | "error" | "interrupted"
        usage?: Usage
      }
      session_id?: string
    }
  | { type: "thinking.delta"; payload?: { text?: string }; session_id?: string }
  | { type: "reasoning.delta"; payload?: { text?: string; verbose?: boolean }; session_id?: string }
  | { type: "reasoning.available"; payload?: { text?: string; verbose?: boolean }; session_id?: string }
  | { type: "status.update"; payload?: { text?: string; kind?: string }; session_id?: string }
  | {
      type: "tool.start"
      payload: {
        tool_id: string
        name?: string
        context?: string
        args_text?: string
      }
      session_id?: string
    }
  | { type: "tool.progress"; payload: { name?: string; preview?: string }; session_id?: string }
  | { type: "tool.generating"; payload: { name?: string }; session_id?: string }
  | {
      type: "tool.complete"
      payload: {
        tool_id: string
        name?: string
        summary?: string
        error?: string
        duration_s?: number
        result_text?: string
      }
      session_id?: string
    }
  | {
      type: "clarify.request"
      payload: { request_id: string; question: string; choices: string[] | null }
      session_id?: string
    }
  | {
      type: "approval.request"
      payload: { command: string; description: string; pattern_keys?: string[] }
      session_id?: string
    }
  | { type: "error"; payload?: { message?: string }; session_id?: string }

const KNOWN = new Set<string>([
  "gateway.ready",
  "gateway.stderr",
  "gateway.start_timeout",
  "gateway.protocol_error",
  "session.info",
  "session.title",
  "message.start",
  "message.delta",
  "message.complete",
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
