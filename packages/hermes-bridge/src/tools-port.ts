/**
 * ToolsPort — platform toolset inventory + enable/disable façade.
 *
 * `hermes tools list` is human-format only. Two sections:
 *   1. `Built-in toolsets (<platform>):` — name + status + description
 *   2. `MCP servers:` — server name + status
 *
 * Enable/disable work via `hermes tools enable NAME` / `disable NAME` with
 * `--platform` to scope. Writes are CLI-driven; reads also tolerate a
 * missing platform header on `hermes tools list` (default = cli).
 *
 * See docs/TOOLS_PORT.md (companion).
 */

import { spawn } from "node:child_process"
import { createTtlCache, PORT_LIST_TTL_MS } from "./port-list-cache.ts"

const listCache = createTtlCache<Tool[]>(PORT_LIST_TTL_MS)

export type ToolPlatform =
	| "cli"
	| "telegram"
	| "discord"
	| "slack"
	| "whatsapp"
	| "whatsapp_cloud"
	| "signal"
	| "bluebubbles"
	| "email"
	| "homeassistant"
	| "mattermost"
	| "matrix"
	| "dingtalk"
	| "feishu"
	| "wecom"
	| "wecom_callback"
	| "weixin"
	| "qqbot"
	| "yuanbao"
	| "webhook"
	| "api_server"
	| "cron"

export type ToolStatus = "enabled" | "disabled" | "partial" | "unknown"

export type ToolKind = "builtin" | "mcp-server"

export type Tool = {
	/** Toolset name (built-in) or server name (MCP). */
	name: string
	kind: ToolKind
	status: ToolStatus
	/** Human-friendly description (built-in only). */
	description?: string
	/** Platform this row applies to (parsed from the section header). */
	platform: ToolPlatform | "default"
	/** Lean: in always-on model schema (when on-demand active). */
	alwaysOn?: boolean
	/** Lean: out of context — reach via tool_search / library. */
	library?: boolean
	/** Original line when parsed from text. */
	raw?: string
}

export type ToolPort = {
	list(opts?: { platform?: ToolPlatform }): Promise<Tool[]>
	enable(name: string, platform?: ToolPlatform): Promise<string>
	disable(name: string, platform?: ToolPlatform): Promise<string>
	/** `hermes tools post-setup <name>` for providers that need post-install hook. */
	postSetup(name: string, platform?: ToolPlatform): Promise<string>
}

/** Optional gateway JSON-RPC (S2). */
export type ToolsGateway = {
	request<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>
}

const VALID_PLATFORMS: ReadonlySet<ToolPlatform> = new Set<ToolPlatform>([
	"cli",
	"telegram",
	"discord",
	"slack",
	"whatsapp",
	"whatsapp_cloud",
	"signal",
	"bluebubbles",
	"email",
	"homeassistant",
	"mattermost",
	"matrix",
	"dingtalk",
	"feishu",
	"wecom",
	"wecom_callback",
	"weixin",
	"qqbot",
	"yuanbao",
	"webhook",
	"api_server",
	"cron",
])

function hermesBin(): string {
	return process.env.HERMES_BIN?.trim() || "hermes"
}

type CliResult = { ok: boolean; stdout: string; stderr: string; code: number }

function runTools(args: string[]): Promise<CliResult> {
	return new Promise((resolve) => {
		const child = spawn(hermesBin(), ["tools", ...args], {
			env: process.env,
			stdio: ["ignore", "pipe", "pipe"],
		})
		const outChunks: Buffer[] = []
		const errChunks: Buffer[] = []
		let outBytes = 0
		const cap = 8 * 1024 * 1024
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

function normalizeStatus(s: string): ToolStatus {
	const v = s.trim().toLowerCase()
	if (v === "enabled" || v === "all tools enabled") return "enabled"
	if (v === "disabled" || v === "all tools disabled") return "disabled"
	if (v.includes("partial") || v.includes("some")) return "partial"
	return "unknown"
}

const BUILTIN_RE = /^\s*([✓✗])\s+(enabled|disabled)\s+([a-z0-9_]+)\s+(.+)$/i
const MCP_RE = /^\s*([a-z0-9_-]+)\s+(.+enabled|.+disabled|partial|.+tools enabled|.+tools disabled|unknown)$/i

/**
 * Parse a single tool row. Returns null if the line doesn't match either
 * built-in or MCP-server shape.
 */
export function parseToolRow(line: string, kind: ToolKind, platform: ToolPlatform | "default"): Tool | null {
	const trimmed = line.replace(/\s+$/, "")
	if (!trimmed) return null
	if (kind === "builtin") {
		const m = BUILTIN_RE.exec(trimmed)
		if (!m) return null
		return {
			name: m[3]!,
			kind: "builtin",
			status: m[2]!.toLowerCase() === "enabled" ? "enabled" : "disabled",
			description: m[4]!.trim(),
			platform,
			raw: trimmed,
		}
	}
	// MCP section: `  server-name  status-text`
	const m = MCP_RE.exec(trimmed)
	if (!m) return null
	return {
		name: m[1]!,
		kind: "mcp-server",
		status: normalizeStatus(m[2]!),
		description: m[2]!.trim(),
		platform,
		raw: trimmed,
	}
}

const SECTION_HEADER = /^(?:Built-in toolsets(?:\s*\(([^)]+)\))?|MCP servers):?\s*$/i

/**
 * Parse a full `hermes tools list` text block. Walks sections, picks the
 * platform from each "Built-in toolsets (<platform>):" header. Falls back to
 * "default" when no platform header precedes a section (legacy / single-row).
 */
export function parseToolsListOutput(text: string): Tool[] {
	const out: Tool[] = []
	const seen = new Set<string>()
	let currentKind: ToolKind | null = null
	let currentPlatform: ToolPlatform | "default" = "default"
	for (const raw of text.split("\n")) {
		const line = raw.trimEnd()
		if (!line.trim()) continue
		const sectionMatch = SECTION_HEADER.exec(line.trim())
		if (sectionMatch) {
			const label = line.trim().toLowerCase()
			if (label.startsWith("mcp")) {
				currentKind = "mcp-server"
				currentPlatform = "default" // MCP rows are platform-agnostic at the server level
			} else if (label.startsWith("built-in")) {
				currentKind = "builtin"
				const p = sectionMatch[1]?.trim().toLowerCase() as ToolPlatform | undefined
				currentPlatform = p && VALID_PLATFORMS.has(p) ? p : "default"
			}
			continue
		}
		if (!currentKind) continue
		const tool = parseToolRow(line, currentKind, currentPlatform)
		if (!tool) continue
		// De-dupe on name+platform (MCP rows can repeat across platforms)
		const key = `${tool.kind}:${tool.name}:${tool.platform}`
		if (seen.has(key)) continue
		seen.add(key)
		out.push(tool)
	}
	return out
}

export function createToolsPort(gw?: ToolsGateway | null): ToolPort {
	return {
		async list(opts = {}) {
			const cacheKey = `list:${opts.platform ?? "default"}`
			const hit = listCache.get(cacheKey)
			if (hit) return hit
			// S2: tools.list / library.tools via gateway
			if (gw) {
				try {
					const r = await gw.request<{
						toolsets?: Array<{
							name: string
							description?: string
							enabled?: boolean
							always_on?: boolean
							library?: boolean
						}>
						on_demand?: boolean
						always_on_tools?: string[]
					}>("tools.list", {})
					if (r.toolsets?.length) {
						const parsed: Tool[] = r.toolsets.map((ts) => ({
							name: ts.name,
							kind: "builtin" as const,
							status: ts.enabled === false ? ("disabled" as const) : ("enabled" as const),
							description: ts.description,
							platform: (opts.platform || "cli") as ToolPlatform,
							alwaysOn: ts.always_on === true,
							library: ts.library === true,
						}))
						listCache.set(cacheKey, parsed)
						return parsed
					}
				} catch {
					/* CLI */
				}
			}
			const args = ["list"]
			if (opts.platform) args.push("--platform", opts.platform)
			const r = await runTools(args)
			if (!r.ok && !r.stdout.trim()) {
				throw new Error(r.stderr.trim() || `hermes tools list failed (${r.code})`)
			}
			const parsed = parseToolsListOutput(r.stdout)
			listCache.set(cacheKey, parsed)
			return parsed
		},

		async enable(name, platform) {
			listCache.invalidate()
			if (gw) {
				try {
					await gw.request("tools.configure", {
						action: "enable",
						names: [name],
					})
					return `enabled ${name}`
				} catch {
					/* CLI */
				}
			}
			const args = ["enable"]
			if (platform) args.push("--platform", platform)
			args.push(name)
			const r = await runTools(args)
			if (!r.ok) throw new Error(r.stderr.trim() || r.stdout.trim() || `enable failed (${r.code})`)
			return (r.stdout || r.stderr).trim()
		},

		async disable(name, platform) {
			listCache.invalidate()
			if (gw) {
				try {
					await gw.request("tools.configure", {
						action: "disable",
						names: [name],
					})
					return `disabled ${name}`
				} catch {
					/* CLI */
				}
			}
			const args = ["disable"]
			if (platform) args.push("--platform", platform)
			args.push(name)
			const r = await runTools(args)
			if (!r.ok) throw new Error(r.stderr.trim() || r.stdout.trim() || `disable failed (${r.code})`)
			return (r.stdout || r.stderr).trim()
		},

		async postSetup(name, platform) {
			const args = ["post-setup"]
			if (platform) args.push("--platform", platform)
			args.push(name)
			const r = await runTools(args)
			listCache.invalidate()
			if (!r.ok) throw new Error(r.stderr.trim() || r.stdout.trim() || `post-setup failed (${r.code})`)
			return (r.stdout || r.stderr).trim()
		},
	}
}

/** Mutable singleton — rebind via {@link bindSkillsToolsGateway}. */
export let toolsPort: ToolPort = createToolsPort()

export function rebindToolsPort(gw?: ToolsGateway | null): ToolPort {
	toolsPort = createToolsPort(gw)
	listCache.invalidate()
	return toolsPort
}

/** One-line label for table list. */
export function formatToolLabel(t: Tool): string {
	const mark = t.status === "enabled" ? "●" : t.status === "disabled" ? "○" : t.status === "partial" ? "◐" : "?"
	const kind = t.kind === "builtin" ? "" : "◇"
	return `${mark}${kind} ${t.name}`
}

/** One-line description for detail pane. */
export function formatToolDescription(t: Tool): string {
	const bits = [
		t.kind === "mcp-server" ? "mcp" : "builtin",
		t.platform !== "default" ? t.platform : null,
		t.status,
		t.description,
	].filter(Boolean)
	return bits.join(" · ").slice(0, 100)
}
