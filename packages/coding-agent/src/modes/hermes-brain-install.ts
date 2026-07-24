/**
 * Install HermesBrain onto a live AgentSession for InteractiveMode.
 *
 * Cadillac rule: one brain. After install, user turns never call OMP
 * AgentSession.prompt / the OMP tool harness. Events for turns come only from
 * HermesGateway → GatewayTurnMapper → session subscribers (EventController).
 *
 * Coat still uses AgentSession for: settings chrome, !bash, session manager
 * files, title helpers. Those are coat-local — see docs/HERMES_BRAIN.md.
 */

import {
  HermesBrain,
  isHermesBrainEnabled,
  type HermesBrainEvent,
  type HermesDialogHost,
} from "@meshina/hermes-bridge"
import type { AgentSession, AgentSessionEvent, PromptOptions } from "../session/agent-session.ts"
import { logger } from "@oh-my-pi/pi-utils"
import { getOrCreateSubagentTrailStore } from "./components/subagent-trail"

export type HermesBrainHandle = {
  brain: HermesBrain
  dispose: () => void
  setDialogHost: (host: HermesDialogHost | null) => void
  /** OMP InteractiveMode.setWorkingMessage — kaomoji / status line (not transcript). */
  setWorkingMessage?: (message?: string) => void
}

const BRAIN_KEY = Symbol.for("meshina.hermesBrain")
const HANDLE_KEY = Symbol.for("meshina.hermesBrainHandle")

export function getInstalledHermesBrain(session: AgentSession): HermesBrain | undefined {
  return (session as unknown as Record<symbol, HermesBrain | undefined>)[BRAIN_KEY]
}

export function getHermesBrainHandle(session: AgentSession): HermesBrainHandle | undefined {
  return (session as unknown as Record<symbol, HermesBrainHandle | undefined>)[HANDLE_KEY]
}

/**
 * Replace turn surface on `session` with Hermes. Call before InteractiveMode
 * constructs / subscribes so EventController only sees Hermes turn events.
 */
export async function installHermesBrain(session: AgentSession): Promise<HermesBrainHandle> {
  const brain = new HermesBrain()
  await brain.bootstrap()

  const origSubscribe = session.subscribe.bind(session)
  const origPrompt = session.prompt.bind(session)
  const origFollowUp = session.followUp.bind(session)
  const origAbort = session.abort.bind(session)
  const origIsStreamingDesc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(session), "isStreaming")

  // Fan Hermes events into the same listeners IM attaches via session.subscribe.
  // OMP agent may still emit (should be idle); we do not strip those — but we never
  // feed it user prompts, so tool harness stays cold.
  // working_status is coat-only (loader) — not an AgentSessionEvent; never forward.
  session.subscribe = (listener: (event: AgentSessionEvent) => void) => {
    const unsubSession = origSubscribe(listener)
    const unsubBrain = brain.subscribe((ev: HermesBrainEvent) => {
      // Feed subagent trail (notices / working_status carry mapped subagent activity)
      try {
        getOrCreateSubagentTrailStore(session).ingest(ev as { type?: string; message?: string; source?: string })
      } catch {
        /* trail optional during bootstrap */
      }
      if (ev.type === "working_status") {
        try {
          // InteractiveMode attaches setWorkingMessage on the session facade via IM ctx;
          // use emit path: optional coat hook hung on session after IM starts.
          const coat = session as unknown as {
            setWorkingMessage?: (m?: string) => void
          }
          // Prefer live IM hook installed below via HANDLE_KEY / setCoatWorkingMessage
          const h = getHermesBrainHandle(session)
          if (h?.setWorkingMessage) {
            h.setWorkingMessage(ev.message)
          } else if (typeof coat.setWorkingMessage === "function") {
            coat.setWorkingMessage(ev.message)
          }
        } catch {
          /* coat not ready */
        }
        return
      }
      listener(ev as unknown as AgentSessionEvent)
    })
    return () => {
      unsubSession()
      unsubBrain()
    }
  }

  session.prompt = async (text: string, options?: PromptOptions): Promise<boolean> => {
    // Synthetic coat-internal prompts (plan mode, etc.) must not hit Hermes until
    // those features are ported — fail loud rather than silent dual-brain.
    if (options?.synthetic) {
      logger.warn("hermes-brain: rejecting synthetic OMP prompt (not ported)", {
        preview: text.slice(0, 80),
      })
      session.emitNotice?.(
        "warning",
        "Hermes brain: synthetic coat prompts are not ported yet (plan/vibe modes).",
        "hermes-brain",
      )
      return false
    }
    await brain.prompt(text)
    return true
  }

  session.followUp = async (text: string): Promise<void> => {
    // Mid-stream: prefer session.steer RPC; else interrupt+prompt (Hermes only).
    await brain.steer(text)
  }

  session.abort = async (options?: {
    reason?: string
    goalReason?: "interrupted" | "internal"
    preserveCompaction?: boolean
  }) => {
    await brain.interrupt()
    // Still run OMP abort to clear local streaming flags / queues without starting tools.
    try {
      await origAbort(options)
    } catch {
      /* OMP may not be streaming */
    }
  }

  const origGetContextUsage = session.getContextUsage.bind(session)
  session.getContextUsage = (options?: { contextWindow?: number }) => {
    const u = brain.sessionInfo.usage
    if (u && (u.context_percent != null || (u.context_used != null && u.context_max != null))) {
      const contextWindow =
        (u.context_max && u.context_max > 0 ? u.context_max : undefined) ??
        options?.contextWindow ??
        session.model?.contextWindow ??
        0
      const tokens =
        u.context_used ??
        u.total_tokens ??
        (u.input_tokens ?? 0) + (u.output_tokens ?? 0)
      const percent =
        u.context_percent ??
        (contextWindow > 0 ? (tokens / contextWindow) * 100 : 0)
      return { tokens, contextWindow, percent }
    }
    return origGetContextUsage(options)
  }

  // Refresh gateway usage after each mapped turn so status line % stays live.
  const unsubUsage = brain.subscribe((ev) => {
    if (ev.type === "turn_end" || ev.type === "agent_end") {
      void brain.refreshInfo().catch(() => {})
    }
  })

  Object.defineProperty(session, "isStreaming", {
    configurable: true,
    enumerable: true,
    get() {
      if (brain.streaming) return true
      if (origIsStreamingDesc?.get) {
        try {
          return Boolean(origIsStreamingDesc.get.call(session))
        } catch {
          return false
        }
      }
      return false
    },
  })

  const handle: HermesBrainHandle = {
    brain,
    setDialogHost: (host) => brain.setDialogHost(host),
    setWorkingMessage: undefined,
    dispose: () => {
      unsubUsage()
      brain.dispose()
      session.subscribe = origSubscribe
      session.prompt = origPrompt
      session.followUp = origFollowUp
      session.abort = origAbort
      session.getContextUsage = origGetContextUsage
      if (origIsStreamingDesc) {
        Object.defineProperty(session, "isStreaming", origIsStreamingDesc)
      }
      delete (session as unknown as Record<symbol, unknown>)[BRAIN_KEY]
      delete (session as unknown as Record<symbol, unknown>)[HANDLE_KEY]
    },
  }

  ;(session as unknown as Record<symbol, HermesBrain>)[BRAIN_KEY] = brain
  ;(session as unknown as Record<symbol, HermesBrainHandle>)[HANDLE_KEY] = handle

  // Surface model from gateway into notice once
  const info = brain.sessionInfo
  if (info.model) {
    session.emitNotice?.(
      "info",
      `Hermes brain · ${info.model}${info.reasoning_effort ? ` · ${info.reasoning_effort}` : ""}`,
      "hermes-brain",
    )
  }

  return handle
}

export { isHermesBrainEnabled }
