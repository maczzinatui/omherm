// Panel loaders — thin gateway queries for toolbar tabs (tier-0 first).

import type { GatewayClient } from "../gateway/client.ts"
import type { TabId } from "./tabs.ts"

export type PanelLines = string[]

function sh(r: { stdout?: string; stderr?: string; code?: number } | unknown): string {
  if (!r || typeof r !== "object") return String(r)
  const o = r as { stdout?: string; stderr?: string; code?: number }
  const out = (o.stdout || "").trim()
  const err = (o.stderr || "").trim()
  if (out) return out
  if (err) return err
  return `(exit ${o.code ?? "?"})`
}

export async function loadPanel(gw: GatewayClient, id: TabId): Promise<PanelLines> {
  try {
    switch (id) {
      case "chat":
        return ["(chat is the main transcript — switch back with toolbar)"]

      case "sessions": {
        const list = await gw.request<{
          sessions?: Array<{
            id?: string
            session_id?: string
            title?: string
            preview?: string
            model?: string
            updated_at?: number
          }>
        }>("session.list", { limit: 40 })
        const rows = list.sessions ?? []
        if (!rows.length) return ["No sessions yet.", "Create from Chat or session.create."]
        return [
          "Sessions (session.list) — resume not wired in spike UI yet",
          "─".repeat(40),
          ...rows.map((s, i) => {
            const id = s.id || s.session_id || "?"
            const title = s.title || id.slice(0, 12)
            const prev = (s.preview || "").replace(/\s+/g, " ").slice(0, 60)
            return `${String(i + 1).padStart(2)}  ${title}  ${s.model || ""}  ${prev}`
          }),
        ]
      }

      case "kanban": {
        const r = await gw.request("shell.exec", {
          command: "hermes kanban list 2>/dev/null | head -60",
        })
        const body = sh(r)
        return ["Kanban (hermes kanban via shell.exec)", "─".repeat(40), ...body.split("\n")]
      }

      case "models":
      case "config": {
        const r = await gw.request<{ config?: Record<string, unknown> }>("config.get", {
          key: "full",
        })
        const cfg = r.config ?? {}
        const model =
          (cfg as { model?: unknown }).model ??
          (cfg as { models?: unknown }).models ??
          null
        const lines = [
          id === "models" ? "Models / routing (config.get full — extract)" : "Config (config.get full)",
          "─".repeat(40),
        ]
        if (model != null) lines.push(`model: ${JSON.stringify(model).slice(0, 500)}`)
        // show a few top-level keys for dogfood
        const keys = Object.keys(cfg).slice(0, 30)
        if (!keys.length) lines.push("(empty config payload)")
        else {
          lines.push("keys: " + keys.join(", "))
          for (const k of keys.slice(0, 12)) {
            const v = cfg[k]
            const snip = JSON.stringify(v)
            lines.push(`  ${k}: ${(snip ?? "undefined").slice(0, 100)}`)
          }
        }
        lines.push("", "Write path: config.set (model picker UI = next slice)")
        return lines
      }

      case "skills": {
        const r = await gw.request<{ skills?: Record<string, string[]> }>("skills.manage", {
          action: "list",
        })
        const skills = r.skills ?? {}
        const lines = ["Skills", "─".repeat(40)]
        for (const [cat, names] of Object.entries(skills)) {
          lines.push(`[${cat}]`)
          for (const n of names) lines.push(`  ${n}`)
        }
        if (lines.length === 2) lines.push("(none)")
        return lines
      }

      case "toolsets": {
        const r = await gw.request<{ toolsets?: Array<{ name?: string; enabled?: boolean }> }>(
          "toolsets.list",
          {},
        )
        const ts = r.toolsets ?? []
        return [
          "Toolsets",
          "─".repeat(40),
          ...(ts.length
            ? ts.map((t) => `${t.enabled === false ? "○" : "●"} ${t.name || "?"}`)
            : ["(none)"]),
        ]
      }

      case "agents": {
        const r = await gw.request<{
          active?: Array<{ subagent_id?: string; goal?: string; status?: string }>
          paused?: boolean
        }>("delegation.status", {})
        const active = r.active ?? []
        return [
          `Agents  paused=${r.paused ?? false}`,
          "─".repeat(40),
          ...(active.length
            ? active.map((a) => `${a.subagent_id || "?"}  ${a.status || ""}  ${(a.goal || "").slice(0, 80)}`)
            : ["(no active subagents)"]),
        ]
      }

      case "cron": {
        const r = await gw.request<{ jobs?: unknown[] } | unknown>("cron.manage", { action: "list" })
        const text = JSON.stringify(r, null, 2)
        return ["Cron (cron.manage list)", "─".repeat(40), ...text.split("\n").slice(0, 50)]
      }

      case "memory": {
        const r = await gw.request("shell.exec", {
          command:
            "wc -c ~/.hermes/memories/MEMORY.md ~/.hermes/memories/USER.md 2>/dev/null; echo '---'; head -20 ~/.hermes/memories/MEMORY.md 2>/dev/null",
        })
        return ["Memory files (shell)", "─".repeat(40), ...sh(r).split("\n")]
      }

      case "context": {
        const r = await gw.request("session.context_breakdown", {})
        return ["Context breakdown", "─".repeat(40), ...JSON.stringify(r, null, 2).split("\n").slice(0, 60)]
      }

      default:
        return [`Unknown tab: ${id}`]
    }
  } catch (e) {
    return [`Error loading ${id}: ${e instanceof Error ? e.message : String(e)}`]
  }
}
