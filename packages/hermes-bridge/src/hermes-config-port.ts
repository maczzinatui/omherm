// HermesConfigPort — public hermes config get/set (CLI). Cadillac: no ad-hoc yaml.

import { shellQuote } from "./profile-dto.ts"
import {
  HERMES_OMP_FIELD_SPECS,
  type HermesOmpFieldSpec,
  type OmpSettingsTab,
} from "./hermes-omp-settings-map.ts"

export type ConfigEffect = "live" | "restart" | "session"

export type HermesConfigField = HermesOmpFieldSpec

/** Full Herm→OMP allowlist (see hermes-omp-settings-map.ts). */
export const HERMES_CONFIG_FIELDS: readonly HermesConfigField[] = HERMES_OMP_FIELD_SPECS

export const HERMES_CONFIG_KEYS: readonly string[] = HERMES_CONFIG_FIELDS.map((f) => f.key)

export type { OmpSettingsTab }

export type RunHermesConfig = (
  argv: string[],
  opts?: { timeoutMs?: number },
) => Promise<{ code: number; stdout: string; stderr: string }>

const defaultRun: RunHermesConfig = async (argv, opts) => {
  const timeoutMs = opts?.timeoutMs ?? 60_000
  const proc = Bun.spawn(["hermes", ...argv], {
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  })
  const timer = setTimeout(() => {
    try {
      proc.kill()
    } catch {
      /* */
    }
  }, timeoutMs)
  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    return { code, stdout, stderr }
  } finally {
    clearTimeout(timer)
  }
}

function parseGetOutput(stdout: string, asJson: boolean): unknown {
  const t = stdout.trim()
  if (!t) return undefined
  if (asJson) {
    try {
      return JSON.parse(t)
    } catch {
      return t
    }
  }
  if (t === "true") return true
  if (t === "false") return false
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  return t
}

function formatSetValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "number") return String(value)
  if (value == null) return ""
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

export function createHermesConfigPort(run: RunHermesConfig = defaultRun) {
  const cache = new Map<string, unknown>()
  let loadedAt = 0

  async function getRaw(key: string): Promise<unknown> {
    const r = await run(["config", "get", key, "--json"])
    if (r.code !== 0) {
      const msg = (r.stderr || r.stdout || "").trim()
      if (/not set|Config key not set/i.test(msg)) return undefined
      throw new Error(msg.slice(0, 400) || `config get ${key} failed`)
    }
    return parseGetOutput(r.stdout, true)
  }

  return {
    fields: HERMES_CONFIG_FIELDS,
    keys: HERMES_CONFIG_KEYS,
    cache,

    isHermesKey(key: string): boolean {
      return (HERMES_CONFIG_KEYS as readonly string[]).includes(key)
    },

    getCached(key: string): unknown {
      return cache.has(key) ? cache.get(key) : undefined
    },

    async refresh(keys: readonly string[] = HERMES_CONFIG_KEYS): Promise<void> {
      const errors: string[] = []
      // Batch in chunks to avoid melting hermes CLI on 80+ keys
      const chunk = 12
      for (let i = 0; i < keys.length; i += chunk) {
        const slice = keys.slice(i, i + chunk)
        await Promise.all(
          slice.map(async (key) => {
            try {
              const v = await getRaw(key)
              cache.set(key, v)
            } catch (e) {
              errors.push(`${key}: ${e instanceof Error ? e.message : String(e)}`)
              const field = HERMES_CONFIG_FIELDS.find((f) => f.key === key)
              if (field && field.fallback !== undefined) cache.set(key, field.fallback)
            }
          }),
        )
      }
      loadedAt = Date.now()
      if (errors.length === keys.length && keys.length > 0) {
        throw new Error(`HermesConfigPort refresh failed: ${errors[0]}`)
      }
    },

    loadedAt(): number {
      return loadedAt
    },

    async get(key: string): Promise<unknown> {
      const v = await getRaw(key)
      cache.set(key, v)
      return v
    },

    async set(key: string, value: unknown): Promise<void> {
      if (!(HERMES_CONFIG_KEYS as readonly string[]).includes(key)) {
        throw new Error(`key not in Hermes settings allowlist: ${key}`)
      }
      const encoded = formatSetValue(value)
      const r = await run(["config", "set", key, encoded])
      if (r.code !== 0) {
        throw new Error((r.stderr || r.stdout || `config set ${key} failed`).trim().slice(0, 500))
      }
      try {
        cache.set(key, await getRaw(key))
      } catch {
        cache.set(key, value)
      }
    },

    buildGetArgv(key: string): string[] {
      return ["config", "get", key, "--json"]
    },
    buildSetArgv(key: string, value: unknown): string[] {
      return ["config", "set", key, formatSetValue(value)]
    },
    formatSetValue,
    shellQuote,
  }
}

export type HermesConfigPort = ReturnType<typeof createHermesConfigPort>

let singleton: HermesConfigPort | null = null

export function hermesConfigPort(): HermesConfigPort {
  if (!singleton) singleton = createHermesConfigPort()
  return singleton
}

export function resetHermesConfigPortForTests(): void {
  singleton = null
}
