/**
 * HermesBrain — single agent-loop owner for the mtui product path.
 *
 * Cadillac: Hermes owns the turn. Coat (InteractiveMode) only paints.
 * This port is the only place product code starts a Hermes turn.
 *
 * Debt (named): AgentSession still hosts coat chrome (settings store, !bash,
 * local session files). Those are coat-local. Turn text/tools never go through
 * OMP Agent.prompt when this brain is installed — no dual harness.
 *
 * Contract tests: hermes-brain.test.ts
 */

import { HermesGateway } from "./client.ts"
import {
  GatewayTurnMapper,
  type MappedAgentSessionEvent,
} from "./session-event-map.ts"
import type { SessionInfo, UiEvent } from "./types.ts"

export type HermesBrainEvent = MappedAgentSessionEvent

export type HermesBrainListener = (event: HermesBrainEvent) => void

export type HermesBrainOptions = {
  /** Injected gateway (tests). Default: new HermesGateway(). */
  gateway?: HermesGateway
  model?: string
  provider?: string
  /** Max ms to wait for agent_end after submit (default 10 min). */
  turnTimeoutMs?: number
}

const DEFAULT_TURN_MS = 600_000

export class HermesBrain {
  readonly gateway: HermesGateway
  readonly mapper: GatewayTurnMapper
  #listeners = new Set<HermesBrainListener>()
  #unsubUi: (() => void) | null = null
  #streaming = false
  #bootstrapped = false
  #turnTimeoutMs: number
  #turnWaiters: Array<{
    resolve: () => void
    reject: (e: Error) => void
    timer: ReturnType<typeof setTimeout>
  }> = []

  constructor(opts: HermesBrainOptions = {}) {
    this.gateway = opts.gateway ?? new HermesGateway()
    this.mapper = new GatewayTurnMapper({
      model: opts.model || "hermes",
      provider: opts.provider || "hermes",
    })
    this.#turnTimeoutMs = opts.turnTimeoutMs ?? DEFAULT_TURN_MS
  }

  get streaming(): boolean {
    return this.#streaming
  }

  get ready(): boolean {
    return this.#bootstrapped && this.gateway.ready
  }

  get sessionInfo(): SessionInfo {
    return this.gateway.sessionInfo
  }

  get sessionId(): string | null {
    return this.gateway.sessionId
  }

  /** Subscribe to mapped OMP-shaped session events (EventController edge). */
  subscribe(listener: HermesBrainListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  /**
   * Start gateway + session.create. Idempotent.
   * Fails loud if gateway cannot start.
   */
  async bootstrap(): Promise<SessionInfo> {
    if (this.#bootstrapped) return this.gateway.sessionInfo
    this.#unsubUi = this.gateway.onUi((ev: UiEvent) => this.#onUi(ev))
    const info = await this.gateway.bootstrap()
    this.mapper.setIdentity(info.model, info.provider)
    this.#bootstrapped = true
    return info
  }

  /**
   * Submit user text to Hermes and wait until the mapped turn closes
   * (agent_end) or timeout / error.
   *
   * Does NOT emit a user message_start — InteractiveMode already paints
   * optimistic user bubbles. Hermes tools/assistant stream via mapper.
   */
  async prompt(text: string): Promise<void> {
    if (!this.#bootstrapped) await this.bootstrap()
    const trimmed = text.trim()
    if (!trimmed) return

    this.#streaming = true
    const wait = this.#waitForTurnEnd()
    try {
      await this.gateway.submit(trimmed)
      await wait
    } catch (e) {
      // Ensure UI leaves streaming state
      for (const ev of this.mapper.forceEnd("error")) this.#emit(ev)
      throw e
    } finally {
      this.#streaming = false
      this.#settleTurnWaiters()
    }
  }

  async interrupt(): Promise<void> {
    try {
      await this.gateway.interrupt()
    } finally {
      for (const ev of this.mapper.forceEnd("aborted")) this.#emit(ev)
      this.#streaming = false
      this.#settleTurnWaiters()
    }
  }

  async refreshInfo(): Promise<SessionInfo> {
    if (!this.#bootstrapped) await this.bootstrap()
    return this.gateway.refreshInfo()
  }

  dispose(): void {
    this.#unsubUi?.()
    this.#unsubUi = null
    this.#listeners.clear()
    for (const w of this.#turnWaiters) {
      clearTimeout(w.timer)
      w.reject(new Error("hermes brain disposed"))
    }
    this.#turnWaiters = []
    this.gateway.kill()
    this.#bootstrapped = false
    this.#streaming = false
  }

  /** Test / inject: feed a UiEvent as if from gateway. */
  feedUiForTest(ev: UiEvent): HermesBrainEvent[] {
    const out = this.mapper.feedUi(ev)
    for (const e of out) this.#emit(e)
    return out
  }

  #onUi(ev: UiEvent): void {
    if (ev.kind === "info") {
      this.mapper.setIdentity(ev.info.model, ev.info.provider)
    }
    if (ev.kind === "error") {
      this.#streaming = true // ensure waiters see a turn attempt
    }
    const mapped = this.mapper.feedUi(ev)
    for (const e of mapped) {
      this.#emit(e)
      if (e.type === "agent_end") {
        this.#streaming = false
        this.#settleTurnWaiters()
      }
      if (e.type === "agent_start") {
        this.#streaming = true
      }
    }
  }

  #emit(e: HermesBrainEvent): void {
    for (const l of this.#listeners) {
      try {
        l(e)
      } catch {
        /* listener errors must not kill the brain */
      }
    }
  }

  #waitForTurnEnd(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.#turnWaiters.findIndex((w) => w.timer === timer)
        if (idx >= 0) this.#turnWaiters.splice(idx, 1)
        reject(new Error(`hermes turn timed out after ${this.#turnTimeoutMs}ms`))
      }, this.#turnTimeoutMs)
      this.#turnWaiters.push({ resolve, reject, timer })
    })
  }

  #settleTurnWaiters(): void {
    const waiters = this.#turnWaiters
    this.#turnWaiters = []
    for (const w of waiters) {
      clearTimeout(w.timer)
      w.resolve()
    }
  }
}

export function isHermesBrainEnabled(): boolean {
  // Product default ON when branded hermes; escape hatch keeps OMP AgentSession loop.
  if (process.env.MESHINA_TUI_OMP_BRAIN === "1" || process.env.MESHINA_TUI_OMP_BRAIN === "true") {
    return false
  }
  if (process.env.MESHINA_TUI_HERMES_BRAIN === "0" || process.env.MESHINA_TUI_HERMES_BRAIN === "false") {
    return false
  }
  if (process.env.MESHINA_TUI_HERMES_BRAIN === "1" || process.env.MESHINA_TUI_HERMES_BRAIN === "true") {
    return true
  }
  return process.env.MESHINA_TUI_BRAND === "hermes"
}
