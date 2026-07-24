/**
 * MemoryPort — built-in memory inventory + provider status façade.
 *
 * Built-in memory (MEMORY.md + USER.md) is always active in Hermes. External
 * providers (honcho, mem0, hindsight, …) are configured via
 * `hermes memory {setup,status,off,reset}` — `status` returns a human-format
 * block we parse; writes go through the interactive `hermes memory setup`
 * (we expose it as-is and tell callers to use a settings overlay for the
 * interactive flow rather than a CLI wrapper).
 *
 * See docs/MEMORY_PORT.md (companion).
 */

import { existsSync, readFileSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { spawn } from "node:child_process"
import { createTtlCache, PORT_LIST_TTL_MS } from "./port-list-cache.ts"

const statusCache = createTtlCache<MemoryStatus>(PORT_LIST_TTL_MS)

export type MemoryKind = "user" | "memory"

export type MemoryFile = {
	kind: MemoryKind
	/** Absolute path on disk (or virtual if missing). */
	path: string
	/** true when file exists at the moment of last read. */
	exists: boolean
	/** UTF-8 decoded contents (empty string when missing). */
	content: string
	/** File byte size on disk (0 when missing). */
	bytes: number
	/** Codepoint count (more useful than bytes for cap reasoning). */
	chars: number
	/** Lines in the file (0 when missing). */
	lines: number
	/** ISO timestamp of last modification (or null when missing). */
	mtime: string | null
}

export type MemoryStatus = {
	/** Always true — built-in memory cannot be disabled. */
	builtInActive: boolean
	/** Currently active external provider name (or 'builtin' when none). */
	provider: string
	/** Status of the external plugin: installed | not_installed | unknown. */
	plugin: "installed" | "not_installed" | "unknown"
	/** Names of all installed external plugins (for reference). */
	installedPlugins: string[]
	/** Raw CLI block (debug). */
	raw: string
}

export type MemoryPort = {
	/** Snapshot the built-in memory files (USER.md, MEMORY.md). */
	read(opts?: { profileHome?: string }): Promise<MemoryFile[]>
	/** One-file shortcut. */
	readOne(kind: MemoryKind, opts?: { profileHome?: string }): Promise<MemoryFile>
	/** `hermes memory status` parser. */
	status(): Promise<MemoryStatus>
}

function hermesBin(): string {
	return process.env.HERMES_BIN?.trim() || "hermes"
}

function hermesHome(): string {
	return process.env.HERMES_HOME?.trim() || join(homedir(), ".hermes")
}

function memoryPath(kind: MemoryKind, home: string): string {
	const dir = join(home, "memories")
	return join(dir, kind === "user" ? "USER.md" : "MEMORY.md")
}

function statMemory(kind: MemoryKind, home: string): MemoryFile {
	const path = memoryPath(kind, home)
	if (!existsSync(path)) {
		return {
			kind,
			path,
			exists: false,
			content: "",
			bytes: 0,
			chars: 0,
			lines: 0,
			mtime: null,
		}
	}
	let content = ""
	try {
		content = readFileSync(path, "utf-8")
	} catch {
		content = ""
	}
	let bytes = 0
	let mtime: string | null = null
	try {
		const st = statSync(path)
		bytes = st.size
		mtime = st.mtime.toISOString()
	} catch {
		/* ignore */
	}
	const lines = content ? content.split(/\r?\n/).length : 0
	return {
		kind,
		path,
		exists: true,
		content,
		bytes,
		chars: [...content].length,
		lines,
		mtime,
	}
}

type CliResult = { ok: boolean; stdout: string; stderr: string; code: number }

function runMemory(args: string[]): Promise<CliResult> {
	return new Promise((resolve) => {
		const child = spawn(hermesBin(), ["memory", ...args], {
			env: process.env,
			stdio: ["ignore", "pipe", "pipe"],
		})
		const outChunks: Buffer[] = []
		const errChunks: Buffer[] = []
		let outBytes = 0
		const cap = 4 * 1024 * 1024
		child.stdout?.on("data", (d: Buffer) => {
			if (outBytes < cap) {
				outChunks.push(d)
				outBytes += d.length
			}
		})
		child.stderr?.on("data", (d: Buffer) => {
			errChunks.push(d)
		})
		child.on("error", (e) => {
			resolve({
				ok: false,
				stdout: Buffer.concat(outChunks).toString("utf-8"),
				stderr: e instanceof Error ? e.message : String(e),
				code: 1,
			})
		})
		child.on("close", (code) => {
			resolve({
				ok: code === 0,
				stdout: Buffer.concat(outChunks).toString("utf-8"),
				stderr: Buffer.concat(errChunks).toString("utf-8"),
				code: code ?? 1,
			})
		})
	})
}

/**
 * Parse the human-format `hermes memory status` block:
 *
 *   Memory status
 *   ────...
 *     Built-in:  always active
 *     Provider:  builtin
 *
 *     Plugin:    NOT installed ✗
 *     Install the 'builtin' memory plugin to ~/.hermes/plugins/
 *
 *     Installed plugins:
 *       • byterover  (API key / local)
 *       • hindsight  (API key / local)
 *       …
 */
export function parseMemoryStatusOutput(text: string): MemoryStatus {
	const builtInActive = /Built-in:?\s*always active/i.test(text)
	const providerMatch = text.match(/^\s*Provider:?\s*(.+)$/im)
	const provider = (providerMatch?.[1] || "").trim() || "builtin"
	const pluginLine = (text.match(/^\s*Plugin:?\s*(.+)$/im)?.[1] || "").trim()
	let plugin: MemoryStatus["plugin"] = "unknown"
	if (/installed\s+✓|installed\s+✓|installed\s+\(active\)|installed\s+\(✓\)/i.test(pluginLine)) {
		plugin = "installed"
	} else if (/NOT installed|not installed|missing/i.test(pluginLine)) {
		plugin = "not_installed"
	}
	const installedPlugins: string[] = []
	const listMatch = text.match(/Installed plugins:\s*\n([\s\S]+?)(?:\n\s*\n|$)/i)
	if (listMatch) {
		for (const line of listMatch[1]!.split("\n")) {
			const m = line.match(/•\s+([A-Za-z0-9_-]+)/)
			if (m) installedPlugins.push(m[1]!)
		}
	}
	return {
		builtInActive,
		provider,
		plugin,
		installedPlugins,
		raw: text,
	}
}

export function createMemoryPort(): MemoryPort {
	return {
		async read(opts = {}) {
			const home = opts.profileHome || hermesHome()
			return [statMemory("user", home), statMemory("memory", home)]
		},

		async readOne(kind, opts = {}) {
			const home = opts.profileHome || hermesHome()
			return statMemory(kind, home)
		},

		async status() {
			// status is CLI-spawned; short TTL so inventory reopen is cheap
			const hit = statusCache.get("status")
			if (hit) return hit
			const r = await runMemory(["status"])
			const text = (r.stdout || r.stderr || "").trim()
			if (!text) throw new Error(r.stderr.trim() || `memory status failed (${r.code})`)
			const parsed = parseMemoryStatusOutput(text)
			statusCache.set("status", parsed)
			return parsed
		},
	}
}

export const memoryPort = createMemoryPort()

/** One-line label for tabs. */
export function formatMemoryLabel(f: MemoryFile): string {
	const mark = f.exists ? "●" : "○"
	return `${mark} ${f.kind === "user" ? "USER.md" : "MEMORY.md"}  ${f.chars}c · ${f.lines}L`
}

/** Short detail for the right pane. */
export function formatMemoryDescription(f: MemoryFile): string {
	if (!f.exists) return "missing — create via /memory or hermes memory …"
	const bits: string[] = []
	if (f.mtime) {
		try {
			const t = Date.parse(f.mtime)
			if (!Number.isNaN(t)) {
				const sec = Math.max(0, Math.floor((Date.now() - t) / 1000))
				const rel =
					sec < 60
						? `${sec}s ago`
						: sec < 3600
							? `${Math.floor(sec / 60)}m ago`
							: sec < 86400
								? `${Math.floor(sec / 3600)}h ago`
								: `${Math.floor(sec / 86400)}d ago`
				bits.push(`updated ${rel}`)
			}
		} catch {
			/* ignore */
		}
	}
	bits.push(`${f.bytes}B`)
	bits.push(`${f.chars}c`)
	return bits.join(" · ").slice(0, 100)
}
