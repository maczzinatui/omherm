// ProfilePort DTOs + pure helpers (Cadillac: no secrets, CLI owns writes).

export const PROFILE_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/

export type EnvRequirement = {
  name: string
  description: string
  required: boolean
  default: string | null
}

export type DistributionSummary = {
  name: string
  version: string
  description: string
  hermes_requires: string
  author: string
  license: string
  env_requires: EnvRequirement[]
  distribution_owned: string[]
  source: string
  installed_at: string
}

export type ProfileInfo = {
  name: string
  path: string
  is_default: boolean
  is_active: boolean
  is_sticky: boolean
  gateway_running: boolean
  model: string | null
  provider: string | null
  has_env: boolean
  skill_count: number
  has_alias: boolean
  soul_preview: string
  distribution: DistributionSummary | null
  description: string | null
}

/** Derive profile name from an absolute HERMES_HOME path. */
export function profileNameFromHome(hermesHome: string): string {
  const normalized = hermesHome.replace(/\/+$/, "") || hermesHome
  const parts = normalized.split("/").filter(Boolean)
  if (parts.length >= 2 && parts[parts.length - 2] === "profiles") {
    return parts[parts.length - 1] ?? "default"
  }
  return "default"
}

/**
 * Hermes root (default home), even when process HERMES_HOME is a named profile.
 * …/profiles/<name> → parent of profiles; else HERMES_HOME itself.
 */
export function hermesRootFromHome(hermesHome: string): string {
  const normalized = hermesHome.replace(/\/+$/, "") || hermesHome
  const parts = normalized.split("/")
  const i = parts.lastIndexOf("profiles")
  if (i > 0 && i === parts.length - 2) {
    return parts.slice(0, i).join("/") || "/"
  }
  return normalized
}

/** Pre-flight only — CLI remains authoritative on create. */
export function validateProfileName(name: string, existing: readonly string[] = []): string | null {
  const n = name.trim()
  if (!n) return "name is required"
  if (n === "default") return "cannot create 'default' (it is the root home)"
  if (!PROFILE_NAME_RE.test(n)) return "must match [a-z0-9][a-z0-9_-]{0,63}"
  if (existing.includes(n)) return `profile '${n}' already exists`
  return null
}

export function shellQuote(arg: string): string {
  if (arg === "") return "''"
  if (/^[a-zA-Z0-9_./:@%+=,-]+$/.test(arg)) return arg
  return `'${arg.replace(/'/g, `'\\''`)}'`
}
