// Hermes slash + skills catalog for omherm autocomplete (product path).

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { defaultHermesHome, hermesRootFromHome } from "./profile-fs.ts"

export type HermesSlashEntry = {
  name: string
  description: string
  source: "hermes-builtin" | "hermes-skill"
  /** skill relative path when source is skill */
  skillPath?: string
}

/** Core Hermes slash names operators expect (forward later via gateway). */
export const HERMES_BUILTIN_SLASH: readonly HermesSlashEntry[] = [
  { name: "model", description: "Switch Hermes model (omherm picker)", source: "hermes-builtin" },
  { name: "reasoning", description: "Set thinking effort (gateway /reasoning)", source: "hermes-builtin" },
  { name: "settings", description: "Open settings (Hermes + coat)", source: "hermes-builtin" },
  { name: "skills", description: "List Hermes skills", source: "hermes-builtin" },
  { name: "reload-skills", description: "Rescan ~/.hermes/skills", source: "hermes-builtin" },
  { name: "status", description: "Hermes status", source: "hermes-builtin" },
  { name: "usage", description: "Usage / context", source: "hermes-builtin" },
  { name: "new", description: "New session (Hermes)", source: "hermes-builtin" },
  { name: "clear", description: "Clear transcript (client)", source: "hermes-builtin" },
  { name: "help", description: "Help", source: "hermes-builtin" },
  { name: "kanban", description: "Kanban (CLI / settings port)", source: "hermes-builtin" },
  { name: "cron", description: "Cron jobs", source: "hermes-builtin" },
  { name: "profile", description: "Profiles", source: "hermes-builtin" },
  { name: "goal", description: "Goal control", source: "hermes-builtin" },
  { name: "browser", description: "Browser CDP", source: "hermes-builtin" },
  { name: "compress", description: "Compress context", source: "hermes-builtin" },
  { name: "yolo", description: "Toggle approval bypass", source: "hermes-builtin" },
] as const

function skillDescription(skillMdPath: string): string {
  try {
    const raw = readFileSync(skillMdPath, "utf-8")
    const m = raw.match(/^description:\s*["']?(.+?)["']?\s*$/m) || raw.match(/^#\s+(.+)$/m)
    return (m?.[1] || "Hermes skill").trim().slice(0, 120)
  } catch {
    return "Hermes skill"
  }
}

/** Scan HERMES_HOME/skills for SKILL.md (same layout as Hermes). */
export function listHermesSkills(home?: string): HermesSlashEntry[] {
  const hh = home || defaultHermesHome()
  const root = join(hermesRootFromHome(hh), "skills")
  if (!existsSync(root)) return []
  const out: HermesSlashEntry[] = []
  const walk = (dir: string) => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      if (name.startsWith(".")) continue
      const p = join(dir, name)
      let st
      try {
        st = statSync(p)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        const skillMd = join(p, "SKILL.md")
        if (existsSync(skillMd)) {
          out.push({
            name: name.replace(/_/g, "-"),
            description: skillDescription(skillMd),
            source: "hermes-skill",
            skillPath: p,
          })
        } else walk(p)
      }
    }
  }
  walk(root)
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

export function buildHermesSlashCatalog(home?: string): HermesSlashEntry[] {
  const skills = listHermesSkills(home)
  const seen = new Set(HERMES_BUILTIN_SLASH.map((c) => c.name))
  const merged = [...HERMES_BUILTIN_SLASH]
  for (const s of skills) {
    if (seen.has(s.name)) continue
    seen.add(s.name)
    merged.push(s)
  }
  return merged
}
