/**
 * HermesBrain — single agent-loop owner for the omherm product path.
 *
 * Cadillac: Hermes owns the turn. Coat (InteractiveMode) only paints.
 * This port is the only place product code starts a Hermes turn.
 *
 * Debt (named): AgentSession still hosts coat chrome (settings store, !bash,
 * local session files). Prefer CockpitSession for new coat call sites.
 * Turn text/tools never go through OMP Agent.prompt when this brain is
 * installed — no dual harness.
 *
 * Contract tests: hermes-brain.test.ts · facade: cockpit-session.ts
 */

import { HermesGateway } from "./client.ts"
import type { MessageImage } from "./cockpit-session.ts"
import {
  GatewayTurnMapper,
  type MappedAgentSessionEvent,
} from "./session-event-map.ts"
import type { LeanProductHandshake, SessionInfo, UiEvent } from "./types.ts"

export type HermesBrainEvent = MappedAgentSessionEvent

export type HermesBrainListener = (event: HermesBrainEvent) => void

/** Coat-side ask dialogs for gateway clarify / approval (InteractiveMode). */
export type HermesDialogHost = {
  clarify: (req: {
    id: string
    question: string
    choices: string[] | null
  }) => Promise<string | undefined>
  approval: (req: {
    command: string
    description: string
    choices: string[]
  }) => Promise<string | undefined>
}

export type HermesBrainOptions = {
  /** Injected gateway (tests). Default: new HermesGateway(). */
  gateway?: HermesGateway
  model?: string
  provider?: string
  /** Max ms to wait for agent_end after submit (default 10 min). */
  turnTimeoutMs?: number
}

const DEFAULT_TURN_MS = 600_000

export const APPROVAL_LABELS: Record<string, string> = {
  once: "Allow once",
  session: "Allow for session",
  always: "Always allow",
  deny: "Deny",
}

export class HermesBrain {
  readonly gateway: HermesGateway
  readonly mapper: GatewayTurnMapper
  #listeners = new Set<HermesBrainListener>()
  #identityListeners = new Set<(info: SessionInfo) => void>()
  #unsubUi: (() => void) | null = null
  #streaming = false
  #bootstrapped = false
  #turnTimeoutMs: number
  #dialogHost: HermesDialogHost | null = null
  #dialogBusy = false
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

  /** S0 lean handshake from hermes-agent-lite (null if stock / missing). */
  get leanProduct(): LeanProductHandshake | null {
    return this.gateway.leanProduct
  }

  get pipelineBudget() {
    return this.gateway.pipelineBudgetState
  }

  /** One-line coat notice for boot (S0). */
  formatLeanBootNotice(): string {
    const lean = this.leanProduct
    if (!lean?.lean && lean?.product !== "hermes-agent-lite") {
      return "Hermes brain: stock/unknown product (not hermes-agent-lite handshake)"
    }
    const bits = [
      "hermes-agent-lite",
      lean.lean_profile ? `profile=${lean.lean_profile}` : null,
      lean.max_iterations != null ? `max_iter=${lean.max_iterations}` : null,
      lean.oauth_safe ? "oauth-safe" : null,
      lean.pipeline_trace ? "pipeline" : null,
    ].filter(Boolean)
    return `Hermes brain: ${bits.join(" · ")}`
  }

  /** Wire OMP ask-dialog (call after InteractiveMode builds ExtensionUiController). */
  setDialogHost(host: HermesDialogHost | null): void {
    this.#dialogHost = host
  }

  /** Coat paint: model/effort identity changed (session.info / refresh). */
  onIdentity(listener: (info: SessionInfo) => void): () => void {
    this.#identityListeners.add(listener)
    return () => this.#identityListeners.delete(listener)
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
    this.mapper.setIdentity(info.model, info.provider, info.reasoning_effort)
    this.#bootstrapped = true
    // S0: always emit lean handshake notice so operator sees product pair
    this.#emit({
      type: "notice",
      level: this.leanProduct?.lean ? "info" : "warning",
      message: this.formatLeanBootNotice(),
      source: "lean-handshake",
    })
    return info
  }

  /**
   * Submit user text to Hermes and wait until the mapped turn closes
   * (agent_end) or timeout / error.
   *
   * Does NOT emit a user message_start — InteractiveMode already paints
   * optimistic user bubbles. Hermes tools/assistant stream via mapper.
   */
  async prompt(text: string, images?: readonly MessageImage[]): Promise<void> {
    if (!this.#bootstrapped) await this.bootstrap()
    const trimmed = text.trim()
    if (!trimmed) return

    this.#streaming = true
    const wait = this.#waitForTurnEnd()
    try {
      await this.gateway.submit(trimmed, images)
      await wait
    } catch (e) {
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

  /**
   * Mid-stream steer when gateway supports it; else interrupt + new prompt
   * (named debt — not dual brain, still Hermes-only).
   */
  async steer(text: string, images?: readonly MessageImage[]): Promise<void> {
    if (!this.#bootstrapped) await this.bootstrap()
    const trimmed = text.trim()
    if (!trimmed) return
    if (this.#streaming) {
      const r = await this.gateway.steer(trimmed, images)
      if (r.mode === "steer") {
        // Turn continues; refresh usage opportunistically.
        void this.refreshInfo().catch(() => {})
        return
      }
      await this.interrupt()
    }
    await this.prompt(trimmed, images)
  }

  async refreshInfo(): Promise<SessionInfo> {
    if (!this.#bootstrapped) await this.bootstrap()
    return this.gateway.refreshInfo()
  }

  /** slash.exec on the live gateway session (not a user turn). */
  async slashExec(command: string): Promise<{ output: string; warning?: string }> {
    if (!this.#bootstrapped) await this.bootstrap()
    return this.gateway.slashExec(command)
  }

  /**
   * Live model switch via gateway `/model … --global` (agent.switch_model +
   * config persist). Config-only writes leave the running session on the old model.
   */
  async switchModel(
    provider: string,
    modelId: string,
    opts?: { global?: boolean },
  ): Promise<{ mode: "gateway" | "config"; command?: string; output?: string }> {
    if (!this.#bootstrapped) await this.bootstrap()
    const { applyHermesModelLive } = await import("./hermes-model-catalog.ts")
    const r = await applyHermesModelLive(provider, modelId, {
      slashExec: cmd => this.gateway.slashExec(cmd),
      global: opts?.global,
    })
    try {
      await this.refreshInfo()
    } catch {
      /* footer optional */
    }
    return r
  }

  async listSessions(limit = 80) {
    if (!this.#bootstrapped) await this.bootstrap()
    return this.gateway.listSessions(limit)
  }

  async resumeSession(sessionId: string) {
    if (!this.#bootstrapped) await this.bootstrap()
    // End any in-flight turn before rebinding.
    if (this.#streaming) {
      try {
        await this.interrupt()
      } catch {
        /* best effort */
      }
    }
    return this.gateway.resumeSession(sessionId)
  }

  dispose(): void {
    // Mid-stream dispose must fail loud into the coat (seal tools, drop
    // stream coalesce, clear loader) — not leave EventController half-armed.
    if (this.#streaming) {
      try {
        this.#emit({
          type: "notice",
          level: "warning",
          message: "Hermes brain disposed mid-stream — turn aborted.",
          source: "hermes-brain",
        } as HermesBrainEvent)
        for (const ev of this.mapper.forceEnd("error")) this.#emit(ev)
      } catch {
        /* coat may already be tearing down */
      }
    }
    this.#unsubUi?.()
    this.#unsubUi = null
    this.#dialogHost = null
    this.#listeners.clear()
    this.#identityListeners.clear()
    for (const w of this.#turnWaiters) {
      clearTimeout(w.timer)
      w.reject(new Error("hermes brain disposed"))
    }
    this.#turnWaiters = []
    this.gateway.kill()
    this.#bootstrapped = false
    this.#streaming = false
  }

  /**
   * Test / inject: feed a UiEvent as if from gateway.
   * Routes through `#onUi` so clarify/approval dialog host path is exercised
   * (not only the mapper). Captures subscribed events for assertions.
   */
  feedUiForTest(ev: UiEvent): HermesBrainEvent[] {
    const captured: HermesBrainEvent[] = []
    const unsub = this.subscribe((e) => {
      captured.push(e)
    })
    try {
      this.#onUi(ev)
    } finally {
      unsub()
    }
    return captured
  }

  #onUi(ev: UiEvent): void {
    if (ev.kind === "info") {
      this.mapper.setIdentity(ev.info.model, ev.info.provider, ev.info.reasoning_effort)
      for (const l of this.#identityListeners) {
        try {
          l(ev.info)
        } catch {
          /* coat optional */
        }
      }
    }
    if (ev.kind === "error") {
      this.#streaming = true
    }

    if (ev.kind === "clarify" || ev.kind === "approval") {
      if (this.#dialogHost && !this.#dialogBusy) {
        void this.#runDialog(ev)
        return
      }
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

  async #runDialog(ev: Extract<UiEvent, { kind: "clarify" | "approval" }>): Promise<void> {
    const host = this.#dialogHost
    if (!host) return
    this.#dialogBusy = true
    try {
      if (ev.kind === "clarify") {
        this.#emit({
          type: "notice",
          level: "info",
          message: `Clarify: ${ev.question}`,
          source: "hermes-gateway",
        } as HermesBrainEvent)
        const answer = await host.clarify({
          id: ev.id,
          question: ev.question,
          choices: ev.choices,
        })
        await this.gateway.respondClarify(ev.id, answer ?? "")
      } else {
        const choices = ev.choices?.length
          ? ev.choices
          : ["once", "session", "always", "deny"]
        this.#emit({
          type: "notice",
          level: "warning",
          message: `Approval: ${ev.description || ev.command}`,
          source: "hermes-gateway",
        } as HermesBrainEvent)
        const choice = await host.approval({
          command: ev.command,
          description: ev.description,
          choices,
        })
        await this.gateway.respondApproval(choice || "deny")
      }
    } catch (e) {
      this.#emit({
        type: "notice",
        level: "error",
        message: `Dialog failed: ${e instanceof Error ? e.message : String(e)}`,
        source: "hermes-gateway",
      } as HermesBrainEvent)
      try {
        if (ev.kind === "approval") await this.gateway.respondApproval("deny")
        else await this.gateway.respondClarify(ev.id, "")
      } catch {
        /* */
      }
    } finally {
      this.#dialogBusy = false
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
