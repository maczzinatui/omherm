/**
 * CronPort — job DTO façade. Prefer gateway later; CLI is contract harness.
 * See docs/CRON_PORT.md. Never invent a parallel job store.
 */

import { spawnSync } from "node:child_process"

export type CronJob = {
  id: string
  name: string | null
  schedule: string | null
  enabled: boolean | null
  raw: string
}

export type CronPort = {
  list(): Promise<CronJob[]>
}

function hermesBin(): string {
  return process.env.HERMES_BIN?.trim() || "hermes"
}

export function parseCronListOutput(text: string): CronJob[] {
  const out: CronJob[] = []
  for (const line of text.split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("NAME") || t.startsWith("---") || t.toLowerCase().includes("no jobs")) continue
    // Loose: first token often id; keep raw line for UI until JSON lands
    const parts = t.split(/\s{2,}|\t+/).filter(Boolean)
    if (parts.length === 0) continue
    const id = parts[0]
    if (id.length < 4) continue
    out.push({
      id,
      name: parts[1] || null,
      schedule: parts.find((p) => /^\d|every |@/.test(p)) || parts[2] || null,
      enabled: /pause|disabled|false/i.test(t) ? false : /true|enabled|active|ok/i.test(t) ? true : null,
      raw: t,
    })
  }
  return out
}

export function createCronPort(): CronPort {
  return {
    async list() {
      const r = spawnSync(hermesBin(), ["cron", "list"], {
        encoding: "utf-8",
        maxBuffer: 4 * 1024 * 1024,
        env: process.env,
      })
      const stdout = r.stdout || ""
      if ((r.status ?? 1) !== 0 && !stdout.trim()) {
        throw new Error((r.stderr || "").trim() || `hermes cron list failed (${r.status})`)
      }
      return parseCronListOutput(stdout)
    },
  }
}

export const cronPort = createCronPort()
