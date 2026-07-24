// Hermes model catalog for mtui picker — inventory API, not OMP registry.

import { existsSync } from "node:fs"
import { hermesAgentRoot } from "./client.ts"

export type HermesModelRow = {
  provider: string
  providerName: string
  id: string
  /** provider/id selector */
  selector: string
  isCurrentProvider: boolean
  isCurrentModel: boolean
}

export type HermesModelCatalog = {
  providers: Array<{
    slug: string
    name: string
    authenticated: boolean
    is_current: boolean
    models: string[]
  }>
  model?: string
  provider?: string
  rows: HermesModelRow[]
}

export type RunCatalog = (code: string) => Promise<{ code: number; stdout: string; stderr: string }>

const defaultRun: RunCatalog = async (code) => {
  const root = hermesAgentRoot()
  const py = [
    `${root}/venv/bin/python`,
    `${root}/venv/bin/python3`,
    `${root}/.venv/bin/python`,
    "python3",
  ].find((p) => p === "python3" || existsSync(p))!
  const proc = Bun.spawn([py, "-c", code], {
    cwd: root,
    env: {
      ...process.env,
      PYTHONPATH: process.env.PYTHONPATH ? `${root}:${process.env.PYTHONPATH}` : root,
    },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, codeN] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { code: codeN, stdout, stderr }
}

const LOADER = `
import json
from hermes_cli.inventory import build_models_payload, load_picker_context
ctx = load_picker_context()
p = build_models_payload(
    ctx,
    include_unconfigured=False,
    picker_hints=True,
    canonical_order=True,
    pricing=False,
    capabilities=False,
    refresh=False,
)
print(json.dumps(p, default=str))
`

function normalizeModels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const m of raw) {
    if (typeof m === "string" && m.trim()) out.push(m.trim())
    else if (m && typeof m === "object" && typeof (m as { id?: string }).id === "string") {
      out.push((m as { id: string }).id)
    }
  }
  return out
}

export function flattenCatalog(payload: {
  providers?: Array<Record<string, unknown>>
  model?: string
  provider?: string
}): HermesModelCatalog {
  const currentModel = typeof payload.model === "string" ? payload.model : ""
  const currentProvider = typeof payload.provider === "string" ? payload.provider : ""
  const providers: HermesModelCatalog["providers"] = []
  const rows: HermesModelRow[] = []
  for (const pr of payload.providers ?? []) {
    const slug = String(pr.slug ?? pr.id ?? "")
    if (!slug) continue
    const name = String(pr.name ?? slug)
    const authenticated = pr.authenticated !== false
    const is_current = Boolean(pr.is_current) || slug === currentProvider
    const models = normalizeModels(pr.models)
    providers.push({ slug, name, authenticated, is_current, models })
    if (!authenticated) continue
    for (const id of models) {
      const selector = id.includes("/") ? id : `${slug}/${id}`
      // Prefer bare id match for current when provider matches
      const isCurrentModel =
        (is_current && (id === currentModel || selector === currentModel || selector.endsWith(`/${currentModel}`))) ||
        id === currentModel
      rows.push({
        provider: slug,
        providerName: name,
        id,
        selector: `${slug}/${id}`,
        isCurrentProvider: is_current,
        isCurrentModel,
      })
    }
  }
  // current first
  rows.sort((a, b) => Number(b.isCurrentModel) - Number(a.isCurrentModel) || a.selector.localeCompare(b.selector))
  return { providers, model: currentModel, provider: currentProvider, rows }
}

export async function loadHermesModelCatalog(
  run: RunCatalog = defaultRun,
): Promise<HermesModelCatalog> {
  const r = await run(LOADER)
  if (r.code !== 0) {
    throw new Error((r.stderr || r.stdout || "model catalog failed").trim().slice(0, 400))
  }
  const payload = JSON.parse(r.stdout) as {
    providers?: Array<Record<string, unknown>>
    model?: string
    provider?: string
  }
  return flattenCatalog(payload)
}

/** Apply model via hermes config set (global default). Session switch needs gateway. */
export async function applyHermesModelGlobal(
  provider: string,
  modelId: string,
  _run: RunCatalog = defaultRun,
): Promise<void> {
  // Use CLI: config set model.default + model.provider
  // bare model id without provider prefix for default when provider-specific
  const bare = bareModelId(provider, modelId)
  const set = async (key: string, value: string) => {
    const proc = Bun.spawn(["hermes", "config", "set", key, value], {
      stdout: "pipe",
      stderr: "pipe",
      env: process.env,
    })
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    if (code !== 0) throw new Error((stderr || stdout || `set ${key} failed`).trim().slice(0, 400))
  }
  await set("model.provider", provider)
  await set("model.default", bare)
}

/** Strip provider prefix from model id when present. */
export function bareModelId(provider: string, modelId: string): string {
  if (modelId.includes("/") && modelId.startsWith(`${provider}/`)) {
    return modelId.slice(provider.length + 1)
  }
  if (modelId.includes("/")) return modelId.split("/").slice(1).join("/")
  return modelId
}

/**
 * Gateway `/model` args that hit tui_gateway `_apply_model_switch` (live agent +
 * optional config persist). `--global` writes config.yaml the same way the
 * stock Hermes TUI does — config-only CLI is not enough for a running session
 * (session model_override / in-memory agent ignore bare config.yaml).
 */
export function formatHermesModelSlash(
  provider: string,
  modelId: string,
  opts?: { global?: boolean },
): string {
  const bare = bareModelId(provider, modelId)
  const g = opts?.global === false ? "" : " --global"
  return `/model ${bare} --provider ${provider}${g}`
}

export type ApplyHermesModelLiveResult = {
  mode: "gateway" | "config"
  command?: string
  output?: string
  warning?: string
}

/**
 * Prefer live gateway slash.exec so the *running* Hermes session actually
 * switches. Falls back to config.yaml CLI when no gateway handle is passed.
 */
export async function applyHermesModelLive(
  provider: string,
  modelId: string,
  opts?: {
    /** Live gateway slash.exec (HermesBrain / HermesGateway). */
    slashExec?: (command: string) => Promise<{ output: string; warning?: string }>
    /** Persist to config.yaml (default true). */
    global?: boolean
  },
): Promise<ApplyHermesModelLiveResult> {
  const global = opts?.global !== false
  const command = formatHermesModelSlash(provider, modelId, { global })
  if (opts?.slashExec) {
    const r = await opts.slashExec(command)
    const blob = `${r.output ?? ""}\n${r.warning ?? ""}`.toLowerCase()
    // Fail loud on known busy / hard failures so coat doesn't green-check a no-op.
    if (
      blob.includes("session busy") ||
      blob.includes("model switch") && blob.includes("failed") ||
      blob.includes("could not switch")
    ) {
      throw new Error((r.output || r.warning || "gateway model switch failed").trim().slice(0, 500))
    }
    return {
      mode: "gateway",
      command,
      output: r.output,
      warning: r.warning,
    }
  }
  await applyHermesModelGlobal(provider, modelId)
  return { mode: "config", command }
}
