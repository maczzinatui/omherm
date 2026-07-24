import { describe, expect, test } from "bun:test"
import {
	formatToolDescription,
	formatToolLabel,
	parseToolRow,
	parseToolsListOutput,
} from "./tools-port.ts"

describe("tools row parse", () => {
	test("parses an enabled built-in row", () => {
		const row = "  ✓ enabled  web  🔍 Web Search & Scraping"
		const t = parseToolRow(row, "builtin", "cli")
		expect(t).not.toBeNull()
		expect(t!.name).toBe("web")
		expect(t!.status).toBe("enabled")
		expect(t!.description).toContain("Web Search")
		expect(t!.platform).toBe("cli")
	})

	test("parses a disabled built-in row", () => {
		const row = "  ✗ disabled  video  🎬 Video Analysis"
		const t = parseToolRow(row, "builtin", "telegram")
		expect(t).not.toBeNull()
		expect(t!.name).toBe("video")
		expect(t!.status).toBe("disabled")
		expect(t!.platform).toBe("telegram")
	})

	test("parses an MCP server row (enabled)", () => {
		const row = "  sovereign-mesh-hub  all tools enabled"
		const t = parseToolRow(row, "mcp-server", "default")
		expect(t).not.toBeNull()
		expect(t!.name).toBe("sovereign-mesh-hub")
		expect(t!.status).toBe("enabled")
		expect(t!.kind).toBe("mcp-server")
	})

	test("rejects random text", () => {
		expect(parseToolRow("not a tool row", "builtin", "cli")).toBeNull()
		expect(parseToolRow("", "builtin", "cli")).toBeNull()
		expect(parseToolRow("MCP servers:", "builtin", "cli")).toBeNull()
	})
})

describe("tools list block parse", () => {
	test("walks two sections, picks platform from header", () => {
		const text = `Built-in toolsets (cli):
  ✓ enabled  web  🔍 Web Search & Scraping
  ✗ disabled  video  🎬 Video Analysis

MCP servers:
  sovereign-mesh-hub  all tools enabled
  glama  all tools disabled
`
		const list = parseToolsListOutput(text)
		const web = list.find((t) => t.name === "web")
		const mcp = list.find((t) => t.name === "sovereign-mesh-hub")
		expect(web?.platform).toBe("cli")
		expect(web?.status).toBe("enabled")
		expect(mcp?.kind).toBe("mcp-server")
		expect(mcp?.status).toBe("enabled")
		const glama = list.find((t) => t.name === "glama")
		expect(glama?.status).toBe("disabled")
	})

	test("tolerates default (no platform) header", () => {
		const text = `Built-in toolsets:
  ✓ enabled  terminal  💻 Terminal & Processes
`
		const list = parseToolsListOutput(text)
		expect(list.length).toBe(1)
		expect(list[0]!.platform).toBe("default")
	})

	test("dedupes on name+platform", () => {
		const text = `Built-in toolsets (cli):
  ✓ enabled  web  Web
  ✓ enabled  web  Web
`
		expect(parseToolsListOutput(text).length).toBe(1)
	})

	test("empty input returns empty", () => {
		expect(parseToolsListOutput("")).toEqual([])
		expect(parseToolsListOutput("Just a stray line\nNothing here\n")).toEqual([])
	})
})

describe("tools label/description", () => {
	test("builtin enabled", () => {
		const t = {
			name: "web",
			kind: "builtin" as const,
			status: "enabled" as const,
			description: "Web Search",
			platform: "cli" as const,
		}
		expect(formatToolLabel(t)).toContain("●")
		expect(formatToolLabel(t)).toContain("web")
		expect(formatToolDescription(t)).toContain("cli")
		expect(formatToolDescription(t)).toContain("enabled")
	})
	test("mcp server enabled", () => {
		const t = {
			name: "x",
			kind: "mcp-server" as const,
			status: "enabled" as const,
			platform: "default" as const,
		}
		expect(formatToolLabel(t)).toContain("◇")
		expect(formatToolDescription(t)).toContain("mcp")
	})
})
