/**
 * Hermes config write lanes — ported from Herm `~/herm/src/config/lane.ts`.
 *
 * Gateway `config.set` only accepts short ALIAS keys (not dotted paths).
 * Several aliases mutate the live agent (reasoning, model, busy, …) so the
 * RPC lane is what makes settings edits stick mid-session without restart.
 * Cold keys go CLI (`hermes config set` via process or gateway `cli.exec`).
 *
 * Research gold: Herm tip 3d2170a. Steal methods only — coat stays OMP chrome.
 */

export type RpcAlias = {
  alias: string
  /** Map schema-typed value → wire string the alias expects. */
  toWire?: (v: unknown) => string
}

const onOff = (v: unknown) => (v ? "on" : "off")

export const TOOL_PROGRESS = ["off", "new", "all", "verbose"] as const
const progress = new Set<string>(TOOL_PROGRESS)
const progressErr = "log is a gateway-only config-file mode, not a live TUI mode"

/** Dotted Hermes key → live gateway config.set alias. */
export const RPC_ALIAS: Record<string, RpcAlias> = {
  model: { alias: "model" },
  provider: { alias: "model" },
  "agent.service_tier": { alias: "fast" },
  "agent.reasoning_effort": { alias: "reasoning" },
  "display.show_reasoning": { alias: "reasoning", toWire: (v) => (v ? "show" : "hide") },
  "display.tool_progress": { alias: "verbose" },
  "display.busy_input_mode": { alias: "busy" },
  "display.details_mode": { alias: "details_mode" },
  "display.thinking_mode": { alias: "thinking_mode" },
  "display.tui_compact": { alias: "compact", toWire: onOff },
  "display.tui_statusbar": { alias: "statusbar" },
  "display.tui_mouse": { alias: "mouse", toWire: onOff },
  "display.skin": { alias: "skin" },
  "display.personality": { alias: "personality" },
  custom_prompt: { alias: "prompt" },
}

export type ConfigLane =
  | { via: "rpc"; alias: string; toWire?: (v: unknown) => string }
  | { via: "cli" }
  | { via: "readonly" }

export function routeConfigKey(key: string): ConfigLane {
  const a = RPC_ALIAS[key]
  if (a) return { via: "rpc", alias: a.alias, toWire: a.toWire }
  if (key.startsWith("display.sections.")) {
    return { via: "rpc", alias: `details_mode.${key.slice("display.sections.".length)}` }
  }
  // list/dict structured → edit YAML (not live TUI)
  if (key.includes("toolsets") || key.endsWith(".list") || key.includes("providers.")) {
    // leave most open to CLI; callers may still refuse
  }
  return { via: "cli" }
}

export function toCliString(value: unknown, typeHint?: "str" | "bool" | "int" | "float"): string {
  const t = typeHint ?? (typeof value === "boolean" ? "bool" : typeof value === "number" ? "float" : "str")
  if (t === "bool") return value ? "true" : "false"
  if (t === "int") return String(Math.trunc(Number(value)))
  if (t === "float") return String(Number(value))
  if (value == null) return ""
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

export type ConfigGw = {
  request<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>
}

export type ConfigDiff = { key: string; to: unknown }

export type ConfigWriteResult = {
  ok: string[]
  failed: { key: string; err: string }[]
  warnings: { key: string; msg: string }[]
  /** How each applied key was written */
  modes: Record<string, "rpc" | "cli">
}

/**
 * Apply config diffs: RPC aliases first (live), then CLI serially.
 * When `gw` is null, RPC keys fall back to CLI dotted-path set (no live apply).
 */
export async function writeConfigLane(
  gw: ConfigGw | null | undefined,
  diffs: ConfigDiff[],
  opts?: {
    /** Fallback CLI runner when no gw or rpc fails open to process CLI */
    runCli?: (argv: string[]) => Promise<{ code: number; stdout: string; stderr: string }>
  },
): Promise<ConfigWriteResult> {
  const ok: string[] = []
  const failed: ConfigWriteResult["failed"] = []
  const warnings: ConfigWriteResult["warnings"] = []
  const modes: Record<string, "rpc" | "cli"> = {}

  const blocked = diffs.filter(
    (d) => d.key === "display.tool_progress" && !progress.has(String(d.to ?? "")),
  )
  for (const d of blocked) failed.push({ key: d.key, err: progressErr })
  const safe = diffs.filter((d) => !blocked.includes(d))

  for (const d of safe) {
    const lane = routeConfigKey(d.key)
    if (lane.via === "readonly") {
      failed.push({ key: d.key, err: "structured value — edit in YAML mode" })
      continue
    }

    if (lane.via === "rpc" && gw) {
      const value = lane.toWire ? lane.toWire(d.to) : String(d.to ?? "")
      try {
        const res = await gw.request<{ warning?: string }>("config.set", {
          key: lane.alias,
          value,
        })
        ok.push(d.key)
        modes[d.key] = "rpc"
        if (res?.warning) warnings.push({ key: d.key, msg: res.warning })
        continue
      } catch (e) {
        // Fall through to CLI so settings still stick on older gateways
        const err = e instanceof Error ? e.message : String(e)
        if (!opts?.runCli) {
          failed.push({ key: d.key, err })
          continue
        }
      }
    }

    // CLI path
    const encoded = toCliString(d.to)
    try {
      if (gw) {
        const res = await gw.request<{
          code: number
          output: string
          blocked?: boolean
          hint?: string
        }>("cli.exec", {
          argv: ["config", "set", d.key, encoded],
          timeout: 30,
        })
        if (res.blocked) failed.push({ key: d.key, err: res.hint ?? "blocked" })
        else if (res.code !== 0)
          failed.push({ key: d.key, err: (res.output || "").split("\n")[0] || `exit ${res.code}` })
        else {
          ok.push(d.key)
          modes[d.key] = "cli"
        }
      } else if (opts?.runCli) {
        const r = await opts.runCli(["config", "set", d.key, encoded])
        if (r.code !== 0) {
          failed.push({
            key: d.key,
            err: (r.stderr || r.stdout || `set ${d.key} failed`).trim().slice(0, 400),
          })
        } else {
          ok.push(d.key)
          modes[d.key] = "cli"
        }
      } else {
        failed.push({ key: d.key, err: "no gateway and no CLI runner" })
      }
    } catch (e) {
      failed.push({ key: d.key, err: e instanceof Error ? e.message : String(e) })
    }
  }

  return { ok, failed, warnings, modes }
}
