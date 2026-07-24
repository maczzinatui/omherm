/**
 * Keep OMP coat chrome (footer model · thinking) in lockstep with live Hermes
 * session identity. Hermes owns the agent; OMP session.model is paint SoT only
 * (CADILLAC ownership map). Never call OMP setModel auth path for Hermes ids.
 */
import type { Model } from "@oh-my-pi/pi-ai"
import { buildModel } from "@oh-my-pi/pi-catalog/build"
import { ThinkingLevel } from "@oh-my-pi/pi-agent-core"
import type { HermesBrain, SessionInfo } from "@omherm/hermes-bridge"
import {
  bareModelId,
  loadHermesModelCatalog,
  pickNextHermesModelRow,
  type HermesModelRow,
} from "@omherm/hermes-bridge"
import type { AgentSession } from "../session/agent-session.ts"
import type { ConfiguredThinkingLevel } from "../thinking"

/** Hermes effort strings ↔ OMP ThinkingLevel (footer + cycle). */
const HERMES_EFFORT_TO_LEVEL: Record<string, ThinkingLevel> = {
  none: ThinkingLevel.Off,
  off: ThinkingLevel.Off,
  false: ThinkingLevel.Off,
  minimal: ThinkingLevel.Minimal,
  min: ThinkingLevel.Minimal,
  low: ThinkingLevel.Low,
  medium: ThinkingLevel.Medium,
  med: ThinkingLevel.Medium,
  high: ThinkingLevel.High,
  xhigh: ThinkingLevel.XHigh,
  "x-high": ThinkingLevel.XHigh,
  max: ThinkingLevel.Max,
}

const LEVEL_TO_HERMES_EFFORT: Partial<Record<ThinkingLevel, string>> = {
  [ThinkingLevel.Off]: "off",
  [ThinkingLevel.Minimal]: "minimal",
  [ThinkingLevel.Low]: "low",
  [ThinkingLevel.Medium]: "medium",
  [ThinkingLevel.High]: "high",
  [ThinkingLevel.XHigh]: "xhigh",
  [ThinkingLevel.Max]: "max",
}

export function mapHermesEffortToThinking(effort: string | undefined | null): ThinkingLevel | undefined {
  if (effort == null || effort === "") return undefined
  const k = String(effort).trim().toLowerCase()
  return HERMES_EFFORT_TO_LEVEL[k]
}

export function mapThinkingToHermesEffort(level: ConfiguredThinkingLevel | ThinkingLevel | undefined): string | undefined {
  if (!level || level === "auto") return undefined
  if (level === ThinkingLevel.Inherit) return undefined
  return LEVEL_TO_HERMES_EFFORT[level as ThinkingLevel]
}

/** Compact footer label: last path segment of id, keep :tag. */
export function hermesFooterModelName(modelId: string): string {
  const bare = modelId.includes("/") ? modelId.split("/").pop() || modelId : modelId
  return bare
}

/**
 * Synthetic OMP Model for coat paint only. reasoning=true so thinking cycle
 * and status-line effort chip work; Hermes still runs the turn.
 */
export function hermesIdentityToModel(provider: string, modelId: string): Model {
  const id = bareModelId(provider, modelId)
  const name = hermesFooterModelName(id)
  return buildModel({
    id,
    name,
    provider: provider || "hermes",
    api: "openai-completions",
    baseUrl: "",
    reasoning: true,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8192,
  })
}

type AgentWithSetModel = {
  setModel: (model: Model) => void
  state: { model?: Model }
}

/**
 * Push Hermes identity into OMP session.agent.state.model + thinkingLevel.
 * Bypasses setModelTemporary auth (Nous etc. are not OMP registry credentials).
 */
export function applyHermesIdentityToSession(
  session: AgentSession,
  info: Pick<SessionInfo, "model" | "provider" | "reasoning_effort">,
  opts?: { modelId?: string; provider?: string },
): { model?: Model; thinking?: ThinkingLevel } {
  const provider = (opts?.provider || info.provider || "").trim()
  const modelId = (opts?.modelId || info.model || "").trim()
  if (!modelId) return {}

  const model = hermesIdentityToModel(provider || "unknown", modelId)
  const agent = session.agent as unknown as AgentWithSetModel
  try {
    agent.setModel(model)
  } catch {
    // Fallback: direct state poke if agent API rejects
    try {
      ;(agent.state as { model?: Model }).model = model
    } catch {
      /* coat only */
    }
  }

  const effort = info.reasoning_effort
  const level = mapHermesEffortToThinking(effort)
  if (level !== undefined) {
    try {
      session.setThinkingLevel(level, false)
    } catch {
      /* optional */
    }
  }

  return { model, thinking: level }
}

/** After bootstrap / live /model / refreshInfo. */
export async function syncCoatFromHermesBrain(
  session: AgentSession,
  brain: HermesBrain,
  override?: { provider?: string; modelId?: string },
): Promise<void> {
  let info = brain.sessionInfo
  try {
    info = await brain.refreshInfo()
  } catch {
    info = brain.sessionInfo
  }
  applyHermesIdentityToSession(session, info, override)
}

/**
 * Cycle thinking on Hermes gateway (`/reasoning <effort> --global`) then coat.
 * Returns new level or undefined if brain missing.
 */
export async function cycleHermesThinking(
  session: AgentSession,
  brain: HermesBrain,
): Promise<ConfiguredThinkingLevel | undefined> {
  const levels: ThinkingLevel[] = [
    ThinkingLevel.Off,
    ThinkingLevel.Low,
    ThinkingLevel.Medium,
    ThinkingLevel.High,
    ThinkingLevel.XHigh,
  ]
  const cur = session.thinkingLevel ?? ThinkingLevel.Off
  const idx = Math.max(0, levels.indexOf(cur as ThinkingLevel))
  const next = levels[(idx + 1) % levels.length]!
  const effort = mapThinkingToHermesEffort(next)
  if (!effort) return undefined
  // Live session + config (Hermes /reasoning --global)
  await brain.slashExec(`/reasoning ${effort} --global`)
  await syncCoatFromHermesBrain(session, brain)
  session.setThinkingLevel(next, true)
  return next
}

export type CycleHermesModelResult = {
  row: HermesModelRow
  /** Short status chip text */
  label: string
}

/**
 * Keyboard model cycle under Hermes brain — walk Hermes inventory via live
 * `/model --global`, never OMP role registry (`cycleRoleModels`).
 */
export async function cycleHermesModel(
  session: AgentSession,
  brain: HermesBrain,
  direction: "forward" | "backward" = "forward",
): Promise<CycleHermesModelResult | undefined> {
  let info = brain.sessionInfo
  try {
    info = await brain.refreshInfo()
  } catch {
    info = brain.sessionInfo
  }
  const catalog = await loadHermesModelCatalog()
  const next = pickNextHermesModelRow(
    catalog.rows,
    { provider: info.provider || catalog.provider, model: info.model || catalog.model },
    direction,
  )
  if (!next) return undefined

  await brain.switchModel(next.provider, next.id, { global: true })
  await syncCoatFromHermesBrain(session, brain, {
    provider: next.provider,
    modelId: next.id,
  })
  const short = hermesFooterModelName(bareModelId(next.provider, next.id))
  return {
    row: next,
    label: `${next.providerName || next.provider} · ${short}`,
  }
}
