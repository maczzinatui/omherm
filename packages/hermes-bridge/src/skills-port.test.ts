import { describe, expect, test } from "bun:test"
import {
	formatSkillDescription,
	formatSkillLabel,
	parseSkillsListOutput,
	parseSkillsListRow,
} from "./skills-port.ts"

describe("skills list row parse", () => {
	test("parses a typical row", () => {
		const row = "│ authoring-adr         │                      │ local    │ local    │ enabled │"
		const s = parseSkillsListRow(row)
		expect(s).not.toBeNull()
		expect(s!.name).toBe("authoring-adr")
		expect(s!.source).toBe("local")
		expect(s!.trust).toBe("local")
		expect(s!.status).toBe("enabled")
		expect(s!.category).toBe("")
	})

	test("parses a builtin row", () => {
		const row = "│ hermes-agent          │ autonomous-ai-agents │ builtin  │ builtin  │ enabled │"
		const s = parseSkillsListRow(row)
		expect(s).not.toBeNull()
		expect(s!.name).toBe("hermes-agent")
		expect(s!.source).toBe("builtin")
		expect(s!.trust).toBe("builtin")
		expect(s!.category).toBe("autonomous-ai-agents")
	})

	test("rejects header rows", () => {
		const header = "│ Name                  │ Category             │ Source   │ Trust    │ Status  │"
		expect(parseSkillsListRow(header)).toBeNull()
	})

	test("rejects box-drawing rules", () => {
		const rule = "┏━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━┓"
		expect(parseSkillsListRow(rule)).toBeNull()
	})

	test("rejects lines without box chars", () => {
		expect(parseSkillsListRow("Installed Skills")).toBeNull()
		expect(parseSkillsListRow("")).toBeNull()
	})

	test("handles disabled status", () => {
		const row = "│ some-skill            │ tools                │ hub      │ official │ disabled │"
		const s = parseSkillsListRow(row)
		expect(s!.status).toBe("disabled")
		expect(s!.source).toBe("hub")
		expect(s!.trust).toBe("official")
	})

	test("tolerates extra trailing whitespace", () => {
		const row = "│ authoring-adr         │                      │ local    │ local    │ enabled │   "
		const s = parseSkillsListRow(row)
		expect(s!.name).toBe("authoring-adr")
	})
})

describe("skills list block parse", () => {
	test("strips header + rules + duplicates", () => {
		const text = `Installed Skills
┏━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━┓
┃ Name                  ┃ Category             ┃ Source   ┃ Trust    ┃ Status  ┃
┡━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━╇━━━━━━━━━━╇━━━━━━━━━┩
│ authoring-adr         │                      │ local    │ local    │ enabled │
│ authoring-adr         │                      │ local    │ local    │ enabled │
│ hermes-agent          │ autonomous-ai-agents │ builtin  │ builtin  │ enabled │
└───────────────────────┴──────────────────────┴──────────┴──────────┴─────────┘`
		const list = parseSkillsListOutput(text)
		expect(list.length).toBe(2)
		expect(list.map((s) => s.name)).toEqual(["authoring-adr", "hermes-agent"])
	})

	test("returns empty when no rows", () => {
		expect(parseSkillsListOutput("Installed Skills\n┏━━┓\n┃ Name ┃\n┗━━┛")).toEqual([])
		expect(parseSkillsListOutput("")).toEqual([])
	})
})

describe("skills label/description", () => {
	test("enabled local", () => {
		const s = {
			name: "x",
			category: "",
			source: "local" as const,
			trust: "local" as const,
			status: "enabled" as const,
		}
		expect(formatSkillLabel(s)).toContain("●")
		expect(formatSkillLabel(s)).toContain("x")
		expect(formatSkillDescription(s)).toContain("local")
		expect(formatSkillDescription(s)).toContain("enabled")
	})
})
