// Readonly profile inventory. Mutations go through profile-cli / ProfilePort.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { basename, dirname, join } from "node:path"
import {
  hermesRootFromHome,
  profileNameFromHome,
  type DistributionSummary,
  type EnvRequirement,
  type ProfileInfo,
} from "./profile-dto.ts"

export function defaultHermesHome(): string {
  return process.env.HERMES_HOME?.trim() || join(process.env.HOME || homedir(), ".hermes")
}

export function stickyDefault(root: string): string | null {
  try {
    const raw = readFileSync(join(root, "active_profile"), "utf-8").trim()
    return raw || null
  } catch {
    return null
  }
}

export function gatewayPidRunning(profileDir: string): boolean {
  try {
    const raw = readFileSync(join(profileDir, "gateway.pid"), "utf-8").trim()
    const pid = raw.startsWith("{")
      ? Number((JSON.parse(raw) as { pid?: number }).pid)
      : Number(raw)
    if (!Number.isFinite(pid) || pid <= 0) return false
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function cleanYamlScalar(s?: string): string | null {
  if (!s) return null
  return s.replace(/^["']|["']$/g, "").trim() || null
}

/** Minimal config.yaml peek — model + provider only. */
export function readModelProvider(dir: string): { model: string | null; provider: string | null } {
  try {
    const raw = readFileSync(join(dir, "config.yaml"), "utf-8")
    const block = raw.split(/^model:\s*$/m)[1]?.split(/^\S/m)[0] ?? ""
    const m =
      block.match(/^\s+(?:default|model):\s*(.+)$/m)?.[1]?.trim() ??
      raw.match(/^model:\s*(\S.+)$/m)?.[1]?.trim()
    const p = block.match(/^\s+provider:\s*(.+)$/m)?.[1]?.trim()
    return { model: cleanYamlScalar(m), provider: cleanYamlScalar(p) }
  } catch {
    return { model: null, provider: null }
  }
}

function soulPreview(dir: string): string {
  try {
    const raw = readFileSync(join(dir, "SOUL.md"), "utf-8")
    const body = raw.replace(/^#[^\n]*\n+/, "").replace(/^\s+/, "")
    return body.slice(0, 400)
  } catch {
    return ""
  }
}

function countSkills(dir: string): number {
  const skills = join(dir, "skills")
  if (!existsSync(skills)) return 0
  let n = 0
  const walk = (d: string) => {
    let entries: string[]
    try {
      entries = readdirSync(d)
    } catch {
      return
    }
    for (const name of entries) {
      const p = join(d, name)
      let st
      try {
        st = statSync(p)
      } catch {
        continue
      }
      if (st.isDirectory()) walk(p)
      else if (name === "SKILL.md") n++
    }
  }
  walk(skills)
  return n
}

function readDescription(dir: string): string | null {
  for (const f of ["DESCRIPTION.md", "description.md", "profile.md"]) {
    try {
      const t = readFileSync(join(dir, f), "utf-8").trim()
      if (t) return t.slice(0, 500)
    } catch {
      /* next */
    }
  }
  return null
}

/** Best-effort distribution.yaml without a YAML dependency. */
export function readDistributionSummary(dir: string): DistributionSummary | null {
  const path = join(dir, "distribution.yaml")
  if (!existsSync(path)) return null
  try {
    const raw = readFileSync(path, "utf-8")
    const grab = (key: string): string => {
      const m = raw.match(new RegExp(`^${key}:\\s*(.*)$`, "m"))
      return cleanYamlScalar(m?.[1]) ?? ""
    }
    const name = grab("name")
    if (!name) return null
    return {
      name,
      version: grab("version") || "0.1.0",
      description: grab("description"),
      hermes_requires: grab("hermes_requires"),
      author: grab("author"),
      license: grab("license"),
      env_requires: [] as EnvRequirement[],
      distribution_owned: [],
      source: grab("source"),
      installed_at: grab("installed_at"),
    }
  } catch {
    return null
  }
}

function hasAlias(name: string): boolean {
  if (name === "default") return false
  const home = process.env.HOME || homedir()
  return existsSync(join(home, ".local", "bin", name))
}

function buildInfo(
  name: string,
  dir: string,
  active: string,
  sticky: string | null,
): ProfileInfo {
  const { model, provider } = readModelProvider(dir)
  return {
    name,
    path: dir,
    is_default: name === "default",
    is_active: name === active,
    is_sticky: name === sticky,
    gateway_running: gatewayPidRunning(dir),
    model,
    provider,
    has_env: existsSync(join(dir, ".env")),
    skill_count: countSkills(dir),
    has_alias: hasAlias(name),
    soul_preview: soulPreview(dir),
    distribution: readDistributionSummary(dir),
    description: readDescription(dir),
  }
}

/**
 * @param activeHome Gateway-reported HERMES_HOME (preferred). Falls back to process env.
 */
export function listProfiles(activeHome?: string | null): ProfileInfo[] {
  const processHome = defaultHermesHome()
  const root = hermesRootFromHome(processHome)
  const active = profileNameFromHome(activeHome?.trim() || processHome)
  const sticky = stickyDefault(root)
  const out: ProfileInfo[] = []

  if (existsSync(root)) {
    out.push(buildInfo("default", root, active, sticky))
  }

  const pr = join(root, "profiles")
  if (existsSync(pr)) {
    let names: string[] = []
    try {
      names = readdirSync(pr)
    } catch {
      names = []
    }
    for (const name of names.sort()) {
      if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(name)) continue
      const dir = join(pr, name)
      try {
        if (!statSync(dir).isDirectory()) continue
      } catch {
        continue
      }
      out.push(buildInfo(name, dir, active, sticky))
    }
  }
  return out
}

export function resolveProfileDir(name: string, root?: string): string | null {
  const r = root ?? hermesRootFromHome(defaultHermesHome())
  if (name === "default") return existsSync(r) ? r : null
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(name)) return null
  const dir = join(r, "profiles", name)
  return existsSync(dir) ? dir : null
}

export { profileNameFromHome, hermesRootFromHome, basename, dirname }
