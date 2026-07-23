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
} from "@meshina/hermes-bridge"
import type { AgentSession, AgentSessionEvent, PromptOptions } from "../session/agent-session.ts"
import { logger } from "@oh-my-pi/pi-utils"

export type HermesBrainHandle = {
  brain: HermesBrain
  dispose: () => void
}

const BRAIN_KEY = Symbol.for("meshina.hermesBrain")

export function getInstalledHermesBrain(session: AgentSession): HermesBrain | undefined {
  return (session as unknown as Record<symbol, HermesBrain | undefined>)[BRAIN_KEY]
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
  session.subscribe = (listener: (event: AgentSessionEvent) => void) => {
    const unsubSession = origSubscribe(listener)
    const unsubBrain = brain.subscribe((ev: HermesBrainEvent) => {
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
    // Mid-stream follow-up: Hermes interrupt+queue not fully wired — submit as next turn.
    if (brain.streaming) {
      await brain.interrupt()
    }
    await brain.prompt(text)
  }

  session.abort = async (options?: { reason?: string; goalReason?: "interrupted" | "internal"; preserveCompaction?: boolean }) => {
    await brain.interrupt()
    // Still run OMP abort to clear local streaming flags / queues without starting tools.
    try {
      await origAbort(options)
    } catch {
      /* OMP may not be streaming */
    }
  }

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

  ;(session as unknown as Record<symbol, HermesBrain>)[BRAIN_KEY] = brain

  // Surface model from gateway into notice once
  const info = brain.sessionInfo
  if (info.model) {
    session.emitNotice?.("info", `Hermes brain · ${info.model}${info.reasoning_effort ? ` · ${info.reasoning_effort}` : ""}`, "hermes-brain")
  }

  const dispose = () => {
    brain.dispose()
    session.subscribe = origSubscribe
    session.prompt = origPrompt
    session.followUp = origFollowUp
    session.abort = origAbort
    if (origIsStreamingDesc) {
      Object.defineProperty(session, "isStreaming", origIsStreamingDesc)
    }
    delete (session as unknown as Record<symbol, unknown>)[BRAIN_KEY]
  }

  return { brain, dispose }
}

export { isHermesBrainEnabled }
