/**
 * Paint Hermes gateway session history into OMP InteractiveMode chat chrome.
 * Research gold: Herm `transcriptToMessages` + turnReducer load (tip 3d2170a).
 * Cadillac: Hermes session store is SoT; coat paint is display-only.
 */

export type HermesTranscriptRow = {
  role?: string
  type?: string
  content?: unknown
  text?: unknown
  name?: string
  context?: string
  summary?: string
}

export type CoatHistoryLine = {
  role: "user" | "assistant" | "system"
  text: string
}

const MAX_PAINT_MESSAGES = 80
const MAX_CHARS_PER_MSG = 12_000

/** Flatten gateway text field (string | parts[]) to plain text. */
export function flattenHermesText(text: unknown): string {
  if (typeof text === "string") return text
  if (!Array.isArray(text)) return ""
  const out: string[] = []
  for (const p of text) {
    if (typeof p === "string") {
      out.push(p)
      continue
    }
    if (p && typeof p === "object") {
      const o = p as Record<string, unknown>
      if (o.type === "text" && typeof o.text === "string") out.push(o.text)
      else if (typeof o.content === "string") out.push(o.content)
      else if (typeof o.text === "string") out.push(o.text)
    }
  }
  return out.join("\n")
}

/**
 * Map gateway resume/history rows → coat lines (user/assistant/system).
 * Tools become dim system lines so the thread stays readable without tool chrome.
 */
export function hermesRowsToCoatHistory(rows: unknown[]): CoatHistoryLine[] {
  const out: CoatHistoryLine[] = []
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue
    const m = raw as HermesTranscriptRow
    const roleRaw = String(m.role || m.type || "").toLowerCase()

    if (roleRaw === "tool" || roleRaw === "tool_call" || roleRaw === "function") {
      const name = (m.name || "tool").trim()
      const ctx = String(m.context || m.summary || flattenHermesText(m.content) || "").trim()
      const line = ctx ? `⚙ ${name} · ${ctx}` : `⚙ ${name}`
      if (line.trim()) out.push({ role: "system", text: line.slice(0, MAX_CHARS_PER_MSG) })
      continue
    }

    let role: CoatHistoryLine["role"] | null = null
    if (roleRaw === "user" || roleRaw === "human") role = "user"
    else if (roleRaw === "assistant" || roleRaw === "model" || roleRaw === "ai") role = "assistant"
    else if (roleRaw === "system") role = "system"
    else continue

    const text = flattenHermesText(m.text ?? m.content).trim()
    if (!text) continue
    out.push({ role, text: text.slice(0, MAX_CHARS_PER_MSG) })
  }
  // Cap tail — long sessions shouldn't freeze the TUI on resume
  if (out.length > MAX_PAINT_MESSAGES) {
    const dropped = out.length - MAX_PAINT_MESSAGES
    return [
      {
        role: "system",
        text: `… ${dropped} earlier messages omitted (showing last ${MAX_PAINT_MESSAGES})`,
      },
      ...out.slice(-MAX_PAINT_MESSAGES),
    ]
  }
  return out
}

export type CoatChatPainter = {
  clearTransientSessionUi?: () => void
  chatContainer?: { clear: () => void }
  addMessageToChat: (
    message: {
      role: "user" | "assistant" | "system" | "custom"
      content: Array<{ type: "text"; text: string }> | string
      attribution?: string
      timestamp: number
      customType?: string
      display?: boolean
    },
    options?: { populateHistory?: boolean },
  ) => unknown
  ui?: { requestRender?: () => void }
  statusLine?: { invalidate?: () => void }
}

/**
 * Clear coat transcript and paint Hermes history rows as OMP chat messages.
 * Returns how many lines painted.
 */
export function paintHermesHistoryOnCoat(
  ctx: CoatChatPainter,
  rows: unknown[],
  opts?: { notice?: string },
): { painted: number; lines: CoatHistoryLine[] } {
  const lines = hermesRowsToCoatHistory(rows)
  try {
    ctx.clearTransientSessionUi?.()
  } catch {
    /* optional */
  }
  try {
    ctx.chatContainer?.clear()
  } catch {
    /* optional */
  }

  const ts = Date.now()
  if (opts?.notice) {
    try {
      ctx.addMessageToChat(
        {
          role: "custom",
          customType: "hermes-resume",
          display: true,
          content: [{ type: "text", text: opts.notice }],
          timestamp: ts,
        },
        { populateHistory: false },
      )
    } catch {
      // fallback: system-like user-visible via assistant
      try {
        ctx.addMessageToChat({
          role: "user",
          content: [{ type: "text", text: opts.notice }],
          attribution: "user",
          timestamp: ts,
        })
      } catch {
        /* paint best-effort */
      }
    }
  }

  let painted = 0
  for (const line of lines) {
    try {
      if (line.role === "user") {
        ctx.addMessageToChat(
          {
            role: "user",
            content: [{ type: "text", text: line.text }],
            attribution: "user",
            timestamp: ts + painted,
          },
          { populateHistory: false },
        )
      } else if (line.role === "assistant") {
        // Prefer custom chrome over full AssistantMessage shape (stopReason/usage…).
        // Looks like a custom card; history is readable; live turns still use mapper.
        ctx.addMessageToChat(
          {
            role: "custom",
            customType: "hermes-history-assistant",
            display: true,
            content: line.text,
            timestamp: ts + painted,
          },
          { populateHistory: false },
        )
      } else {
        ctx.addMessageToChat(
          {
            role: "custom",
            customType: "hermes-history",
            display: true,
            content: line.text,
            timestamp: ts + painted,
          },
          { populateHistory: false },
        )
      }
      painted++
    } catch {
      /* skip bad row */
    }
  }

  try {
    ctx.ui?.requestRender?.()
    ctx.statusLine?.invalidate?.()
  } catch {
    /* */
  }
  return { painted, lines }
}

/**
 * Resolve coat contextWindow from Hermes usage / optional explicit max.
 * Prefer live usage.context_max; fallback chain for synthetic Model.
 */
export function resolveHermesContextWindow(
  info: { usage?: { context_max?: number; context_used?: number } | null },
  explicit?: number | null,
  fallback = 128_000,
): number {
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) {
    return Math.trunc(explicit)
  }
  const max = info.usage?.context_max
  if (typeof max === "number" && Number.isFinite(max) && max > 0) {
    return Math.trunc(max)
  }
  return fallback
}
