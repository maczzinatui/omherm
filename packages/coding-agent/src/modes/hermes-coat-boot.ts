/**
 * Coat-only session options when Hermes brain owns the agent loop.
 *
 * OMP createAgentSession still runs so InteractiveMode has a host for chrome
 * (!bash, settings store, title). Under Hermes product brand the OMP tool
 * harness / MCP / extension discovery must not load — dual brain + boot bloat.
 *
 * Escape: MESHINA_TUI_OMP_BRAIN=1 → isHermesBrainEnabled() false → full OMP.
 */

import type { CreateAgentSessionOptions } from "../sdk.ts"
import { isHermesBrainEnabled } from "@omherm/hermes-bridge"

/** True when interactive product path will install HermesBrain. */
export function shouldThinOmpAgentHarness(): boolean {
  return isHermesBrainEnabled()
}

/**
 * Mutate session create options for Hermes-brain interactive coat.
 * Safe to call only when `shouldThinOmpAgentHarness()` is true.
 */
export function applyHermesCoatSessionOptions(
  options: CreateAgentSessionOptions,
): CreateAgentSessionOptions {
  // Empty active tool set + restrict so createTools does not widen with builtins,
  // custom tools, or auto-learn force-includes. Also disables MCP/LSP/IRC inside sdk.
  options.toolNames = []
  options.restrictToolNames = true
  options.enableMCP = false
  options.enableLsp = false
  options.enableIrc = false
  options.skipPythonPreflight = true
  options.disableExtensionDiscovery = true
  options.additionalExtensionPaths = []
  // OMP skills/rules are not the Hermes skill surface (ports + gateway).
  options.skills = []
  // Drop OMP agent system prompt bulk — Hermes owns turns; coat needs no pi system.
  // Keep undefined custom so sdk still builds something for AgentSession ctor; empty
  // tools + no prompt submit means it never hits the wire under brain install.
  return options
}

export type HermesCoatBootSummary = {
  thinned: boolean
  toolNames: string[]
  restrictToolNames: boolean
  enableMCP: boolean
  disableExtensionDiscovery: boolean
}

export function summarizeHermesCoatBoot(options: CreateAgentSessionOptions): HermesCoatBootSummary {
  return {
    thinned: options.restrictToolNames === true && Array.isArray(options.toolNames) && options.toolNames.length === 0,
    toolNames: options.toolNames ? [...options.toolNames] : [],
    restrictToolNames: options.restrictToolNames === true,
    enableMCP: options.enableMCP !== false && options.restrictToolNames !== true,
    disableExtensionDiscovery: options.disableExtensionDiscovery === true,
  }
}
