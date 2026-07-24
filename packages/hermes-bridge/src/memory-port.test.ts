import { describe, expect, test } from "bun:test"
import {
	formatMemoryDescription,
	formatMemoryLabel,
	parseMemoryStatusOutput,
} from "./memory-port.ts"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

describe("memory status parse", () => {
	test("parses built-in always active + builtin provider + no plugin", () => {
		const text = `Memory status
────────────────────────────────────────
  Built-in:  always active
  Provider:  builtin

  Plugin:    NOT installed ✗
  Install the 'builtin' memory plugin to ~/.hermes/plugins/

  Installed plugins:
    • byterover  (API key / local)
    • hindsight  (API key / local)
`
		const s = parseMemoryStatusOutput(text)
		expect(s.builtInActive).toBe(true)
		expect(s.provider).toBe("builtin")
		expect(s.plugin).toBe("not_installed")
		expect(s.installedPlugins).toEqual(["byterover", "hindsight"])
	})

	test("parses external provider installed", () => {
		const text = `Memory status
─────────
  Built-in:  always active
  Provider:  mem0

  Plugin:    installed ✓
  Install the 'builtin' memory plugin to ~/.hermes/plugins/

  Installed plugins:
    • mem0  (API key / local)
`
		const s = parseMemoryStatusOutput(text)
		expect(s.provider).toBe("mem0")
		expect(s.plugin).toBe("installed")
		expect(s.installedPlugins).toEqual(["mem0"])
	})

	test("missing status section returns unknowns", () => {
		const s = parseMemoryStatusOutput("")
		expect(s.builtInActive).toBe(false)
		expect(s.provider).toBe("builtin")
		expect(s.plugin).toBe("unknown")
		expect(s.installedPlugins).toEqual([])
	})
})

describe("memory file read", () => {
	test("reads USER and MEMORY files from a temp hermes home", async () => {
		const dir = mkdtempSync(join(tmpdir(), "memory-port-"))
		try {
			// port expects <home>/memories/USER.md and <home>/memories/MEMORY.md
			const { mkdirSync } = await import("node:fs")
			mkdirSync(join(dir, "memories"), { recursive: true })
			writeFileSync(join(dir, "memories", "USER.md"), "# me\nname: mac")
			writeFileSync(join(dir, "memories", "MEMORY.md"), "## ops\n- reflex 1\n- reflex 2")
			const { memoryPort } = await import("./memory-port.ts")
			const files = await memoryPort.read({ profileHome: dir })
			expect(files.length).toBe(2)
			const user = files.find((f) => f.kind === "user")!
			const mem = files.find((f) => f.kind === "memory")!
			expect(user.content).toContain("mac")
			expect(mem.content).toContain("reflex 1")
			expect(user.exists).toBe(true)
			expect(mem.exists).toBe(true)
			expect(user.chars).toBeGreaterThan(0)
			expect(user.lines).toBe(2)
		} finally {
			rmSync(dir, { recursive: true, force: true })
		}
	})

	test("missing files come back exists=false", async () => {
		const dir = mkdtempSync(join(tmpdir(), "memory-port-empty-"))
		try {
			const { memoryPort } = await import("./memory-port.ts")
			const files = await memoryPort.read({ profileHome: dir })
			for (const f of files) {
				expect(f.exists).toBe(false)
				expect(f.content).toBe("")
				expect(f.bytes).toBe(0)
			}
		} finally {
			rmSync(dir, { recursive: true, force: true })
		}
	})
})

describe("memory label/description", () => {
	test("label has size + line count", () => {
		expect(formatMemoryLabel({
			kind: "user",
			path: "",
			exists: true,
			content: "a\nb\nc",
			bytes: 5,
			chars: 5,
			lines: 3,
			mtime: null,
		})).toContain("USER.md")
		expect(formatMemoryLabel({
			kind: "memory",
			path: "",
			exists: true,
			content: "x",
			bytes: 1,
			chars: 1,
			lines: 1,
			mtime: null,
		})).toContain("MEMORY.md")
	})
	test("description shows missing note when no file", () => {
		expect(formatMemoryDescription({
			kind: "user",
			path: "",
			exists: false,
			content: "",
			bytes: 0,
			chars: 0,
			lines: 0,
			mtime: null,
		})).toContain("missing")
	})
})
