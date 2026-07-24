import { describe, expect, test } from "bun:test"
import {
	formatKanbanLabel,
	mapKanbanJsonRow,
	parseKanbanBoardsList,
	parseKanbanListJson,
	parseKanbanListOutput,
} from "./kanban-port.ts"

describe("kanban list parse", () => {
	test("parses hermes kanban list lines", () => {
		const text = `
▶ t_b7088a12  ready     (unassigned)          M1′: omherm dogfood
✓ t_deadbeef  done      (herm)                shipped coat
`
		const tasks = parseKanbanListOutput(text)
		expect(tasks.length).toBe(2)
		expect(tasks[0].id).toBe("t_b7088a12")
		expect(tasks[0].status).toBe("ready")
		expect(tasks[0].assignee).toBe(null)
		expect(tasks[0].title).toContain("omherm")
		expect(tasks[1].assignee).toBe("herm")
	})

	test("parses json list", () => {
		const tasks = parseKanbanListJson(
			JSON.stringify([
				{ id: "t_aaaa1111", title: "x", status: "todo", assignee: null, priority: 10 },
			]),
		)
		expect(tasks).toHaveLength(1)
		expect(tasks[0].priority).toBe(10)
		expect(formatKanbanLabel(tasks[0])).toContain("t_aaaa1111")
	})

	test("map row", () => {
		const t = mapKanbanJsonRow({ id: "t_1", title: "a", status: "blocked", assignee: "p" })
		expect(t.assignee).toBe("p")
		expect(t.status).toBe("blocked")
	})

	test("parses boards list", () => {
		const text = `
    SLUG                      NAME                          COUNTS
●   default                   Default                       blocked=4, done=22, ready=4
    other                     Other Board                   todo=3

Current board: default
`
		const boards = parseKanbanBoardsList(text)
		expect(boards.length).toBeGreaterThanOrEqual(1)
		const def = boards.find((b) => b.slug === "default")
		expect(def?.current).toBe(true)
		expect(def?.name).toMatch(/Default/i)
	})
})
