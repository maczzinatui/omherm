/**
 * CockpitSession — narrow facade for coat chrome over Hermes brain.
 *
 * Cadillac: UI should depend on this contract, not OMP AgentSession forever.
 * HermesBrain remains the turn owner; this is a thin typed surface.
 *
 * Spec: docs/HERMES_GUT_PLAN.md §Adapter contract
 */

import type { HermesBrain, HermesBrainEvent, HermesBrainListener } from "./hermes-brain.ts"
import type { SessionInfo } from "./types.ts"

/**
 * Minimal cockpit surface. Expand only when a coat call site needs it —
 * do not mirror full AgentSession.
 */
export type CockpitSession = {
  /** Live session snapshot (model, effort, cwd, usage, …). */
  info(): SessionInfo
  /** Subscribe to mapped turn / notice events. Returns unsubscribe. */
  onEvent(cb: HermesBrainListener): () => void
  /** User turn → Hermes gateway (not OMP Agent.prompt). */
  submit(text: string): Promise<void>
  /** Abort in-flight Hermes turn. */
  interrupt(): Promise<void>
  /** Mid-stream steer when supported; else interrupt+submit. */
  steer(text: string): Promise<void>
  /** Refresh identity/usage from gateway. */
  refreshInfo(): Promise<SessionInfo>
  /** Gateway slash.exec (not a chat turn). */
  slashExec(command: string): Promise<{ output: string; warning?: string }>
  readonly streaming: boolean
  readonly ready: boolean
  readonly sessionId: string | null
  /** Escape hatch: underlying brain (ports / install). Prefer facade methods. */
  readonly brain: HermesBrain
}

/** Wrap a live HermesBrain as CockpitSession. */
export function createCockpitSession(brain: HermesBrain): CockpitSession {
  return {
    get brain() {
      return brain
    },
    get streaming() {
      return brain.streaming
    },
    get ready() {
      return brain.ready
    },
    get sessionId() {
      return brain.sessionId
    },
    info: () => brain.sessionInfo,
    onEvent: (cb: HermesBrainListener) => brain.subscribe(cb),
    submit: (text: string) => brain.prompt(text),
    interrupt: () => brain.interrupt(),
    steer: (text: string) => brain.steer(text),
    refreshInfo: () => brain.refreshInfo(),
    slashExec: (command: string) => brain.slashExec(command),
  }
}

/** Type guard for tests / optional wiring. */
export function isCockpitSession(v: unknown): v is CockpitSession {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as CockpitSession).info === "function" &&
    typeof (v as CockpitSession).submit === "function" &&
    typeof (v as CockpitSession).interrupt === "function" &&
    typeof (v as CockpitSession).onEvent === "function" &&
    "brain" in (v as object)
  )
}

export type { HermesBrainEvent, HermesBrainListener }
