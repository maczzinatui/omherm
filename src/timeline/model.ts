// Pure timeline reducer: gateway events → in-transcript segments + footer.

import type { GatewayEvent, SessionInfo, Usage } from "../gateway/wire"

export type Phase = "boot" | "ready" | "streaming" | "waiting" | "error"

export type Segment =
  | { kind: "system"; text: string }
  | { kind: "user"; text: string }
  | { kind: "thinking"; text: string; open: boolean }
  | { kind: "tool"; id: string; name: string; args?: string; preview?: string; summary?: string; error?: string; open: boolean }
  | { kind: "text"; text: string; open: boolean }
  | { kind: "error"; text: string }

export type Footer = {
  phase: Phase
  model?: string
  cwd?: string
  title?: string
  sessionId?: string
  status?: string
  toolCount: number
  skillCount: number
  usage?: Usage
}

export type State = {
  segments: Segment[]
  footer: Footer
  info?: SessionInfo
}

export function initialState(): State {
  return {
    segments: [{ kind: "system", text: "meshina-tui · waiting for Hermes gateway…" }],
    footer: { phase: "boot", toolCount: 0, skillCount: 0 },
  }
}

function countMap(m?: Record<string, string[]>): number {
  return m ? Object.values(m).reduce((n, v) => n + v.length, 0) : 0
}

function lastOpen(segments: Segment[], kind: Segment["kind"]): number {
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i]
    if (s.kind === kind && "open" in s && s.open) return i
  }
  return -1
}

export function applyEvent(state: State, ev: GatewayEvent): State {
  const segments = state.segments.slice()
  let footer = { ...state.footer }
  let info = state.info

  switch (ev.type) {
    case "gateway.ready":
      footer = { ...footer, phase: "ready", status: "gateway ready" }
      segments.push({ kind: "system", text: "gateway ready" })
      break

    case "gateway.stderr":
      segments.push({ kind: "system", text: `stderr: ${ev.payload.line}` })
      break

    case "gateway.start_timeout":
      footer = { ...footer, phase: "error", status: "gateway start timeout" }
      segments.push({ kind: "error", text: "gateway start timeout — is ~/.hermes/hermes-agent installed?" })
      break

    case "gateway.protocol_error":
      segments.push({ kind: "error", text: `protocol: ${ev.payload?.preview ?? "?"}` })
      break

    case "session.info": {
      info = ev.payload
      footer = {
        ...footer,
        phase: footer.phase === "boot" ? "ready" : footer.phase,
        model: info.model,
        cwd: info.cwd,
        sessionId: info.session_id ?? footer.sessionId,
        title: info.title ?? footer.title,
        toolCount: countMap(info.tools),
        skillCount: countMap(info.skills),
        usage: info.usage ?? footer.usage,
        status: info.model ? `Connected — ${info.model}` : "Connected",
      }
      segments.push({
        kind: "system",
        text: info.model
          ? `Connected — ${info.model} · ${footer.toolCount} tools · ${footer.skillCount} skills`
          : "Connected to Hermes",
      })
      if (info.credential_warning)
        segments.push({ kind: "system", text: info.credential_warning })
      break
    }

    case "session.title":
      footer = {
        ...footer,
        title: ev.payload.title ?? footer.title,
        sessionId: ev.payload.session_id ?? footer.sessionId,
      }
      break

    case "status.update":
      footer = { ...footer, status: ev.payload?.text ?? footer.status }
      break

    case "message.start": {
      footer = { ...footer, phase: "streaming" }
      segments.push({ kind: "text", text: "", open: true })
      break
    }

    case "message.delta": {
      const chunk = ev.payload?.text ?? ""
      if (!chunk) break
      const i = lastOpen(segments, "text")
      if (i >= 0) {
        const s = segments[i] as Extract<Segment, { kind: "text" }>
        segments[i] = { ...s, text: s.text + chunk }
      } else {
        segments.push({ kind: "text", text: chunk, open: true })
      }
      footer = { ...footer, phase: "streaming" }
      break
    }

    case "message.complete": {
      const p = ev.payload
      const i = lastOpen(segments, "text")
      if (i >= 0) {
        const s = segments[i] as Extract<Segment, { kind: "text" }>
        const text = p?.text != null ? p.text : s.text
        segments[i] = { kind: "text", text: text ?? "", open: false }
      } else if (p?.text) {
        segments.push({ kind: "text", text: p.text, open: false })
      }
      if (p?.status === "error")
        segments.push({ kind: "error", text: p.text || "request failed" })
      if (p?.status === "interrupted")
        segments.push({ kind: "system", text: "[interrupted]" })
      footer = {
        ...footer,
        phase: "ready",
        usage: p?.usage ?? footer.usage,
        status: "Ready",
      }
      break
    }

    case "thinking.delta":
    case "reasoning.delta": {
      const chunk = ev.payload?.text ?? ""
      if (!chunk) break
      const i = lastOpen(segments, "thinking")
      if (i >= 0) {
        const s = segments[i] as Extract<Segment, { kind: "thinking" }>
        segments[i] = { ...s, text: s.text + chunk }
      } else {
        segments.push({ kind: "thinking", text: chunk, open: true })
      }
      footer = { ...footer, phase: "streaming", status: "thinking" }
      break
    }

    case "reasoning.available": {
      const t = ev.payload?.text ?? ""
      if (!t) break
      const i = lastOpen(segments, "thinking")
      if (i >= 0) {
        const s = segments[i] as Extract<Segment, { kind: "thinking" }>
        segments[i] = { ...s, text: t, open: false }
      } else {
        segments.push({ kind: "thinking", text: t, open: false })
      }
      break
    }

    case "tool.start": {
      segments.push({
        kind: "tool",
        id: ev.payload.tool_id,
        name: ev.payload.name || "tool",
        args: ev.payload.args_text || ev.payload.context,
        open: true,
      })
      footer = { ...footer, phase: "streaming", status: `tool ${ev.payload.name || ""}`.trim() }
      break
    }

    case "tool.progress": {
      for (let i = segments.length - 1; i >= 0; i--) {
        const s = segments[i]
        if (s.kind === "tool" && s.open) {
          segments[i] = {
            ...s,
            preview: ev.payload.preview ?? s.preview,
            name: ev.payload.name || s.name,
          }
          break
        }
      }
      break
    }

    case "tool.generating": {
      for (let i = segments.length - 1; i >= 0; i--) {
        const s = segments[i]
        if (s.kind === "tool" && s.open) {
          segments[i] = { ...s, name: ev.payload.name || s.name }
          break
        }
      }
      break
    }

    case "tool.complete": {
      let hit = false
      for (let i = segments.length - 1; i >= 0; i--) {
        const s = segments[i]
        if (s.kind === "tool" && (s.id === ev.payload.tool_id || s.open)) {
          segments[i] = {
            ...s,
            name: ev.payload.name || s.name,
            summary: ev.payload.summary,
            error: ev.payload.error,
            open: false,
          }
          hit = true
          if (s.id === ev.payload.tool_id) break
        }
      }
      if (!hit) {
        segments.push({
          kind: "tool",
          id: ev.payload.tool_id,
          name: ev.payload.name || "tool",
          summary: ev.payload.summary,
          error: ev.payload.error,
          open: false,
        })
      }
      break
    }

    case "error":
      footer = { ...footer, phase: "error", status: "error" }
      segments.push({ kind: "error", text: ev.payload?.message || "error" })
      break

    case "clarify.request":
      footer = { ...footer, phase: "waiting", status: "clarify" }
      segments.push({
        kind: "system",
        text: `clarify: ${ev.payload.question}${ev.payload.choices?.length ? ` [${ev.payload.choices.join(" | ")}]` : ""}`,
      })
      break

    case "approval.request":
      footer = { ...footer, phase: "waiting", status: "approval" }
      segments.push({
        kind: "system",
        text: `approval: ${ev.payload.description || ev.payload.command}`,
      })
      break
  }

  return { segments, footer, info }
}

export function pushUser(state: State, text: string): State {
  return {
    ...state,
    segments: [...state.segments, { kind: "user", text }],
    footer: { ...state.footer, phase: "streaming", status: "submitted" },
  }
}

export function formatFooter(f: Footer): [string, string] {
  const sid = f.sessionId ? f.sessionId.slice(0, 8) : "—"
  const l1 = [f.cwd || process.cwd(), f.title || sid].filter(Boolean).join("  ·  ")
  const ctx =
    f.usage?.context_percent != null
      ? `ctx ${Math.round(f.usage.context_percent)}%`
      : f.usage?.context_used != null && f.usage?.context_max != null
        ? `ctx ${f.usage.context_used}/${f.usage.context_max}`
        : null
  const l2 = [
    f.phase === "streaming" ? "Streaming" : f.phase === "waiting" ? "Waiting" : f.phase === "error" ? "Error" : "Ready",
    f.model,
    ctx,
    f.toolCount ? `${f.toolCount} tools` : null,
    f.skillCount ? `${f.skillCount} skills` : null,
    f.status && f.status !== f.model ? f.status : null,
  ]
    .filter(Boolean)
    .join("  ·  ")
  return [l1, l2]
}

export function formatSegment(s: Segment): string {
  switch (s.kind) {
    case "system":
      return `· ${s.text}`
    case "user":
      return `❯ ${s.text}`
    case "thinking":
      return s.open ? `⋯ thinking… ${s.text.slice(-120)}` : `⋯ ${collapse(s.text)}`
    case "tool": {
      const head = s.open ? `▸ ${s.name}` : s.error ? `✗ ${s.name}` : `▹ ${s.name}`
      const meta = s.open
        ? s.preview || s.args || ""
        : s.error || s.summary || ""
      return meta ? `${head}: ${oneLine(meta)}` : head
    }
    case "text":
      return s.text
    case "error":
      return `! ${s.text}`
  }
}

function oneLine(t: string): string {
  return t.replace(/\s+/g, " ").trim().slice(0, 160)
}

function collapse(t: string): string {
  const line = oneLine(t)
  return line.length > 100 ? `${line.slice(0, 100)}…` : line || "(thinking)"
}
