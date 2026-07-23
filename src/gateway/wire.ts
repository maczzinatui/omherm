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

export type GatewayEvent = {
  session_id?: string
} & (
  | { type: "gateway.ready"; payload?: { skin?: GatewaySkin } }
  | { type: "gateway.stderr"; payload: { line: string } }
  | { type: "gateway.start_timeout"; payload?: { cwd?: string; python?: string } }
  | { type: "gateway.protocol_error"; payload?: { preview?: string } }
  | { type: "session.info"; payload: SessionInfo }
  | { type: "session.title"; payload: { session_id?: string; title?: string } }
  | { type: "message.start"; payload?: undefined }
  | { type: "message.delta"; payload?: { text?: string; rendered?: string } }
  | {
      type: "message.complete"
      payload?: {
        text?: string | null
        rendered?: string
        reasoning?: string
        status?: "complete" | "error" | "interrupted"
        usage?: Usage
      }
    }
  | { type: "thinking.delta"; payload?: { text?: string } }
  | { type: "reasoning.delta"; payload?: { text?: string; verbose?: boolean } }
  | { type: "reasoning.available"; payload?: { text?: string; verbose?: boolean } }
  | { type: "status.update"; payload?: { text?: string; kind?: string } }
  | {
      type: "tool.start"
      payload: {
        tool_id: string
        name?: string
        context?: string
        args_text?: string
      }
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
      }
    }
  | { type: "clarify.request"; payload: { request_id: string; question: string; choices: string[] | null } }
  | { type: "approval.request"; payload: { command: string; description: string; pattern_keys?: string[] } }
  | { type: "error"; payload?: { message?: string } }
  | { type: string; payload?: unknown }
)
