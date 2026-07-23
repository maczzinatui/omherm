import { describe, expect, test } from "bun:test"
import { parseKanbanListOutput } from "./kanban-port.ts"
import { parseCronListOutput } from "./cron-port.ts"

describe("kanban list parse", () => {
  test("parses hermes kanban list lines", () => {
    const sample = `
▶ t_b7088a12  ready     (unassigned)          M1′: OMP UI + Hermes backend
✓ t_30bc6e40  done      (auditor)             Inventory live fork
`
    const tasks = parseKanbanListOutput(sample)
    expect(tasks.length).toBe(2)
    expect(tasks[0].id).toBe("t_b7088a12")
    expect(tasks[0].status).toBe("ready")
    expect(tasks[0].assignee).toBeNull()
    expect(tasks[0].title).toContain("M1")
    expect(tasks[1].assignee).toBe("auditor")
  })
})

describe("cron list parse", () => {
  test("skips headers and keeps raw", () => {
    const sample = `
NAME     SCHEDULE    STATUS
abc123   every 2h    enabled
`
    const jobs = parseCronListOutput(sample)
    expect(jobs.some((j) => j.id === "abc123")).toBe(true)
  })
})
