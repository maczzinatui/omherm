/**
 * KanbanPort — board DTO façade. Writes only via `hermes kanban` CLI.
 * See docs/KANBAN_PORT.md. UI never imports SQL column names.
 */

import { spawnSync } from "node:child_process"

export type KanbanTask = {
  id: string
  title: string
  status: string
  assignee: string | null
  priority?: number | null
}

export type KanbanPort = {
  list(opts?: { status?: string; limit?: number; board?: string }): Promise<KanbanTask[]>
  show(id: string, board?: string): Promise<string>
}

function hermesBin(): string {
  return process.env.HERMES_BIN?.trim() || "hermes"
}

function runKanban(args: string[]): { ok: boolean; stdout: string; stderr: string; code: number } {
  const r = spawnSync(hermesBin(), ["kanban", ...args], {
    encoding: "utf-8",
    maxBuffer: 8 * 1024 * 1024,
    env: process.env,
  })
  return {
    ok: r.status === 0,
    stdout: r.stdout || "",
    stderr: r.stderr || "",
    code: r.status ?? 1,
  }
}

/** Parse `hermes kanban list` human lines into DTOs (CLI JSON varies by version). */
export function parseKanbanListOutput(text: string): KanbanTask[] {
  const out: KanbanTask[] = []
  for (const line of text.split("\n")) {
    // e.g. "▶ t_b7088a12  ready     (unassigned)          M1′: …"
    const m = line.match(/(t_[a-f0-9]{8,})\s+(\S+)\s+\(([^)]*)\)\s+(.*)$/i)
    if (!m) continue
    const assignee = m[3].trim()
    out.push({
      id: m[1],
      status: m[2],
      assignee: !assignee || assignee === "unassigned" ? null : assignee,
      title: m[4].trim(),
    })
  }
  return out
}

export function createKanbanPort(): KanbanPort {
  return {
    async list(opts = {}) {
      const args = ["list"]
      if (opts.board) args.unshift("--board", opts.board)
      const r = runKanban(args)
      if (!r.ok && !r.stdout.trim()) {
        throw new Error(r.stderr.trim() || `hermes kanban list failed (${r.code})`)
      }
      const parsed = parseKanbanListOutput(r.stdout)
      if (opts.status) return parsed.filter((t) => t.status === opts.status)
      if (opts.limit) return parsed.slice(0, opts.limit)
      return parsed
    },
    async show(id, board) {
      const args = board ? ["--board", board, "show", id] : ["show", id]
      const r = runKanban(args)
      if (!r.ok) throw new Error(r.stderr.trim() || `hermes kanban show failed (${r.code})`)
      return r.stdout
    },
  }
}

export const kanbanPort = createKanbanPort()
