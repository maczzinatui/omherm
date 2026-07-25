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
  createCockpitSession,
  isHermesBrainEnabled,
  type CockpitSession,
  type HermesBrainEvent,
  type HermesDialogHost,
} from "@omherm/hermes-bridge"
import type { AgentSession, AgentSessionEvent, PromptOptions } from "../session/agent-session.ts"
import { logger } from "@oh-my-pi/pi-utils"
import { getOrCreateSubagentTrailStore } from "./components/subagent-trail"
import { isLeanPipelineFooterMessage, PIPELINE_FOOTER_KEY } from "./pipeline-footer.ts"
import { bootMark } from "./utils/perf-counters"

export { PIPELINE_FOOTER_KEY }

export type HermesBootNotice = {
  level: "info" | "warning" | "error"
  message: string
  source?: string
}

export type HermesBrainHandle = {
  brain: HermesBrain
  /** Narrow facade — prefer for new coat call sites over raw brain. */
  cockpit: CockpitSession
  dispose: () => void
  setDialogHost: (host: HermesDialogHost | null) => void
  /** OMP InteractiveMode.setWorkingMessage — kaomoji / status line (not transcript). */
  setWorkingMessage?: (message?: string) => void
  /**
   * E11: persistent status-line / footer strip for lean pipeline stage
   * (current or last). Clear with undefined on next user turn if desired.
   */
  setPipelineFooter?: (label?: string) => void
  /** Invalidate footer/status after Hermes identity (model/effort) changes. */
  invalidateChrome?: () => void
  /**
   * Lean handshake + model identity for startup paint. Emitted during install
   * *before* InteractiveMode/EventController subscribe, so callers must push
   * these into runInteractiveMode `notifs` (or flush on first subscribe).
   */
  startupNotices: HermesBootNotice[]
}

const BRAIN_KEY = Symbol.for("omherm.hermesBrain")
const HANDLE_KEY = Symbol.for("omherm.hermesBrainHandle")
const COCKPIT_KEY = Symbol.for("omherm.cockpitSession")

/**
 * Decide whether a synthetic prompt may flow through the Hermes brain.
 *
 * Synthetic = OMP-attributed message (plan mode, advisor auto-continue, vibe
 * re-prime, reminders). Default behavior: reject loud — those features are not
 * Hermes-port-equivalent yet, and silently routing them would be a silent dual
 * brain.
 *
 * Narrow exception: plan-mode approval (`hermesPlanMode: true`) — the user
 * already saw the plan in the review overlay and clicked approve, so the
 * execution turn is a deliberate user action. We tag it with an info notice so
 * the operator sees the routing.
 *
 * Honest contract: `synthetic: true` alone is the dangerous case. Any future
 * port adds a sibling flag, not a widening of this gate.
 */
export function shouldAcceptSyntheticPrompt(opts: {
  synthetic?: boolean
  hermesPlanMode?: boolean
}): { accept: boolean; noticeLevel?: "info" | "warning"; notice?: string } {
  if (!opts.synthetic) return { accept: true }
  if (opts.hermesPlanMode) {
    return {
      accept: true,
      noticeLevel: "info",
      notice: "Hermes brain: plan-mode approval routed as a Hermes turn.",
    }
  }
  return {
    accept: false,
    noticeLevel: "warning",
    notice: "Hermes brain: synthetic coat prompts are not ported yet (plan/vibe modes).",
  }
}

export function getInstalledHermesBrain(session: AgentSession): HermesBrain | undefined {
  return (session as unknown as Record<symbol, HermesBrain | undefined>)[BRAIN_KEY]
}

export function getInstalledCockpitSession(session: AgentSession): CockpitSession | undefined {
  return (session as unknown as Record<symbol, CockpitSession | undefined>)[COCKPIT_KEY]
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
  bootMark("hermes_brain_bootstrap_start")
  await brain.bootstrap()
  bootMark("hermes_brain_bootstrap_done")

  // S0 lean handshake + model identity — must be painted AFTER IM subscribes.
  // brain.bootstrap already #emit'd lean-handshake into an empty listener set;
  // session.emitNotice here would also die silent (EventController not up yet).
  const startupNotices: HermesBootNotice[] = [
    {
      level: brain.leanProduct?.lean ? "info" : "warning",
      message: brain.formatLeanBootNotice(),
      source: "lean-handshake",
    },
  ]
  const info = brain.sessionInfo
  if (info.model) {
    startupNotices.push({
      level: "info",
      message: `Hermes brain · ${info.model}${info.reasoning_effort ? ` · ${info.reasoning_effort}` : ""}${
        info.usage?.context_max ? ` · ctx ${info.usage.context_max.toLocaleString()}` : ""
      }`,
      source: "hermes-brain",
    })
  }
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
            setPipelineFooter?: (m?: string) => void
          }
          // Prefer live IM hook installed below via HANDLE_KEY / setCoatWorkingMessage
          const h = getHermesBrainHandle(session)
          if (h?.setWorkingMessage) {
            h.setWorkingMessage(ev.message)
          } else if (typeof coat.setWorkingMessage === "function") {
            coat.setWorkingMessage(ev.message)
          }
          // E11: lean pipeline labels are persistent footer (status line hook strip)
          const msg = String(ev.message || "")
          if (isLeanPipelineFooterMessage(msg)) {
            if (h?.setPipelineFooter) h.setPipelineFooter(msg)
            else if (typeof coat.setPipelineFooter === "function") coat.setPipelineFooter(msg)
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
    const gate = shouldAcceptSyntheticPrompt({
      synthetic: options?.synthetic,
      hermesPlanMode: options?.hermesPlanMode,
    })
    if (!gate.accept) {
      logger.warn("hermes-brain: rejecting synthetic OMP prompt (not ported)", {
        preview: text.slice(0, 80),
      })
      session.emitNotice?.(gate.noticeLevel!, gate.notice!, "hermes-brain")
      return false
    }
    if (gate.notice) {
      session.emitNotice?.(gate.noticeLevel!, gate.notice, "hermes-brain")
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
  // Bump contextUsageRevision so status-line context memoization invalidates
  // (private OMP counter only moves on pending snapshot; Hermes owns real %).
  let hermesCtxRevBump = 0
  const proto = Object.getPrototypeOf(session)
  const origCtxRevDesc = Object.getOwnPropertyDescriptor(proto, "contextUsageRevision")
  Object.defineProperty(session, "contextUsageRevision", {
    configurable: true,
    enumerable: true,
    get() {
      let base = 0
      try {
        if (typeof origCtxRevDesc?.get === "function") {
          base = Number(origCtxRevDesc.get.call(session) ?? 0)
        }
      } catch {
        base = 0
      }
      return base + hermesCtxRevBump
    },
  })

  const unsubUsage = brain.subscribe((ev) => {
    if (ev.type === "turn_end" || ev.type === "agent_end") {
      void brain
        .refreshInfo()
        .then(() => {
          hermesCtxRevBump++
        })
        .catch(() => {})
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

  // Surface Hermes identity into OMP coat (footer model · thinking).
  // session.model stays MiniMax/etc. until we poke agent.setModel — paint only.
  const { applyHermesIdentityToSession, syncCoatFromHermesBrain } = await import(
    "./hermes-coat-identity.ts"
  )
  applyHermesIdentityToSession(session, brain.sessionInfo)
  const unsubIdentity = brain.onIdentity(info => {
    applyHermesIdentityToSession(session, info)
    try {
      getHermesBrainHandle(session)?.invalidateChrome?.()
    } catch {
      /* IM may not be up yet */
    }
  })
  const unsubInfo = brain.subscribe((ev: HermesBrainEvent) => {
    if (ev.type === "turn_end" || ev.type === "agent_end") {
      void syncCoatFromHermesBrain(session, brain).catch(() => {})
    }
  })
  // Initial async refresh (gateway config may lag session.create info)
  void syncCoatFromHermesBrain(session, brain).catch(() => {})

  // Herm config lane: attach live gateway so settings hot keys use config.set RPC
  // (not CLI-only). Research gold: ~/herm/src/config/lane.ts
  try {
    const { hermesConfigPort, bindSkillsToolsGateway } = await import("@omherm/hermes-bridge")
    hermesConfigPort().setGateway(brain.gateway)
    // S2: skills/tools inventory + library over JSON-RPC (CLI fallback remains)
    bindSkillsToolsGateway(brain.gateway)
  } catch {
    /* optional — settings still CLI */
  }

  const cockpit = createCockpitSession(brain)

  const handle: HermesBrainHandle = {
    brain,
    cockpit,
    startupNotices,
    setDialogHost: (host) => brain.setDialogHost(host),
    setWorkingMessage: undefined,
    dispose: () => {
      unsubUsage()
      unsubInfo()
      unsubIdentity()
      void import("@omherm/hermes-bridge")
        .then(({ hermesConfigPort, bindSkillsToolsGateway }) => {
          hermesConfigPort().setGateway(null)
          bindSkillsToolsGateway(null)
        })
        .catch(() => {})
      brain.dispose()
      session.subscribe = origSubscribe
      session.prompt = origPrompt
      session.followUp = origFollowUp
      session.abort = origAbort
      session.getContextUsage = origGetContextUsage
      try {
        delete (session as unknown as { contextUsageRevision?: unknown }).contextUsageRevision
      } catch {
        /* restore via prototype */
      }
      if (origIsStreamingDesc) {
        Object.defineProperty(session, "isStreaming", origIsStreamingDesc)
      }
      delete (session as unknown as Record<symbol, unknown>)[BRAIN_KEY]
      delete (session as unknown as Record<symbol, unknown>)[HANDLE_KEY]
      delete (session as unknown as Record<symbol, unknown>)[COCKPIT_KEY]
    },
  }

  ;(session as unknown as Record<symbol, HermesBrain>)[BRAIN_KEY] = brain
  ;(session as unknown as Record<symbol, HermesBrainHandle>)[HANDLE_KEY] = handle
  ;(session as unknown as Record<symbol, CockpitSession>)[COCKPIT_KEY] = cockpit

  return handle
}

export { isHermesBrainEnabled }
