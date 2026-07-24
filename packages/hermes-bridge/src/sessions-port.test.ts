import { describe, expect, test } from "bun:test"
import { parseSessionsListOutput } from "./sessions-port.ts"

describe("sessions list parse", () => {
	test("parses table rows", () => {
		const text = `
Title                        Workspace          Last Active   ID
────────────────────────────────────────────────────────────────
Fixing TUI crash when open   —                  just now      20260724_093153_99e80f
Lead Architect Boot Endpoi   meshina            7h ago        20260724_092910_f924a6
`
		const rows = parseSessionsListOutput(text)
		expect(rows.length).toBe(2)
		expect(rows[0].id).toBe("20260724_093153_99e80f")
		expect(rows[0].title).toContain("TUI crash")
		expect(rows[1].workspace).toBe("meshina")
	})
})
