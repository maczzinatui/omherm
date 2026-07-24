/**
 * SkillsPort — installed skill inventory + enable/disable façade.
 *
 * `hermes skills list` is human-format only (no `--json` flag at the CLI
 * layer). Parse the table rows. Writes go through `hermes skills config`
 * (interactive) which we drive non-interactively via `hermes skills enable`
 * and `hermes skills disable` for individual toggles.
 *
 * See docs/SKILLS_PORT.md (companion).
 */

import { spawn } from "node:child_process"

export type SkillSource = "builtin" | "hub" | "local" | "unknown"
export type SkillTrust = "builtin" | "official" | "local" | "unknown"

export type Skill = {
	/** Skill name (kebab / underscore normalized; matches the SKILL.md dir). */
	name: string
	category: string
	source: SkillSource
	trust: SkillTrust
	/** enabled | disabled | unknown */
	status: "enabled" | "disabled" | "unknown"
	/** True when the user modified the bundled skill (per `list-modified`). */
	userModified?: boolean
	/** Original table row when parsed from text. */
	raw?: string
}

export type SkillPort = {
	list(opts?: { source?: "all" | "hub" | "builtin" | "local"; enabledOnly?: boolean }): Promise<Skill[]>
	inspect(name: string): Promise<string>
	enable(name: string): Promise<string>
	disable(name: string): Promise<string>
	/** `hermes skills list-modified` — bundled skills the operator edited. */
	listModified(): Promise<string[]>
}

function hermesBin(): string {
	return process.env.HERMES_BIN?.trim() || "hermes"
}

type CliResult = { ok: boolean; stdout: string; stderr: string; code: number }

function runSkills(args: string[]): Promise<CliResult> {
	return new Promise((resolve) => {
		const child = spawn(hermesBin(), ["skills", ...args], {
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

function normalizeSource(s: string): SkillSource {
	const v = s.trim().toLowerCase()
	if (v === "builtin") return "builtin"
	if (v === "hub") return "hub"
	if (v === "local") return "local"
	return "unknown"
}

function normalizeTrust(s: string): SkillTrust {
	const v = s.trim().toLowerCase()
	if (v === "builtin") return "builtin"
	if (v === "official") return "official"
	if (v === "local") return "local"
	return "unknown"
}

function normalizeStatus(s: string): Skill["status"] {
	const v = s.trim().toLowerCase()
	if (v === "enabled") return "enabled"
	if (v === "disabled") return "disabled"
	return "unknown"
}

/**
 * Parse one `hermes skills list` table row. The CLI emits box-drawing
 * characters with `│` as column separator and strips the value cell padding.
 * Tolerant of trailing whitespace, mixed unicode, and the empty category
 * column ("local" + "local" rows often have no category at all).
 */
export function parseSkillsListRow(line: string): Skill | null {
	// Must be a table row: starts and ends with │ (or similar) and has at least 4 inner cells.
	const trimmed = line.replace(/\s+$/, "")
	if (!trimmed.includes("│")) return null
	const cells = trimmed
		.split("│")
		.map((c) => c.trim())
		.filter((c, i, a) => !(i === 0 || i === a.length - 1)) // strip outer box chars
	if (cells.length < 4) return null

	// Some rows have an empty leading category cell — pad to 5 so indexing
	// (name, category, source, trust, status) stays stable.
	while (cells.length < 5) cells.splice(1, 0, "")
	const [name, category, source, trust, status] = cells
	if (!name) return null
	// The header row is the only one with literal "Name", "Source", "Trust", "Status".
	if (/^name$/i.test(name)) return null
	if (/^category$/i.test(category)) return null

	return {
		name,
		category: category || "",
		source: normalizeSource(source || ""),
		trust: normalizeTrust(trust || ""),
		status: normalizeStatus(status || ""),
		raw: trimmed,
	}
}

/**
 * Parse a full `hermes skills list` text block into DTOs. Strips section
 * headers (e.g. "Installed Skills"), box-drawing rules, and noise lines.
 */
export function parseSkillsListOutput(text: string): Skill[] {
	const out: Skill[] = []
	const seen = new Set<string>()
	for (const line of text.split("\n")) {
		const t = line.trim()
		if (!t) continue
		// Skip box-drawing horizontal rules.
		if (/^[┏┓┗┛┡┩├┤┣┫┯┷┬┴┼─━│╭╮╰╯╞╡╪╤╧╥╨╘╛╒╕╓╖╔╗╚╝═]+$/.test(t)) continue
		// Skip non-row text.
		if (!t.includes("│")) continue
		const skill = parseSkillsListRow(t)
		if (!skill) continue
		if (seen.has(skill.name)) continue
		seen.add(skill.name)
		out.push(skill)
	}
	return out
}

export function createSkillsPort(): SkillPort {
	return {
		async list(opts = {}) {
			const args = ["list"]
			if (opts.source && opts.source !== "all") args.push("--source", opts.source)
			if (opts.enabledOnly) args.push("--enabled-only")
			const r = await runSkills(args)
			if (!r.ok && !r.stdout.trim()) {
				throw new Error(r.stderr.trim() || `hermes skills list failed (${r.code})`)
			}
			let parsed = parseSkillsListOutput(r.stdout)
			if (opts.enabledOnly) parsed = parsed.filter((s) => s.status === "enabled")
			return parsed
		},

		async inspect(name) {
			const r = await runSkills(["inspect", name])
			if (!r.ok && !r.stdout.trim()) {
				throw new Error(r.stderr.trim() || `inspect failed (${r.code})`)
			}
			return (r.stdout || r.stderr).trim()
		},

		async enable(name) {
			const r = await runSkills(["enable", name])
			if (!r.ok) throw new Error(r.stderr.trim() || r.stdout.trim() || `enable failed (${r.code})`)
			return (r.stdout || r.stderr).trim()
		},

		async disable(name) {
			const r = await runSkills(["disable", name])
			if (!r.ok) throw new Error(r.stderr.trim() || r.stdout.trim() || `disable failed (${r.code})`)
			return (r.stdout || r.stderr).trim()
		},

		async listModified() {
			const r = await runSkills(["list-modified"])
			if (!r.ok && !r.stdout.trim()) {
				throw new Error(r.stderr.trim() || `list-modified failed (${r.code})`)
			}
			// `list-modified` emits one skill name per line. Skip headers / blanks.
			return r.stdout
				.split("\n")
				.map((l) => l.trim())
				.filter((l) => l && !/^(name|---|==)/i.test(l))
		},
	}
}

export const skillsPort = createSkillsPort()

/** One-line label for table list. */
export function formatSkillLabel(s: Skill): string {
	const mark = s.status === "enabled" ? "●" : s.status === "disabled" ? "○" : "?"
	const src = s.source === "builtin" ? "★" : s.source === "hub" ? "◇" : s.source === "local" ? "·" : "?"
	return `${mark}${src} ${s.name}`
}

/** One-line description for detail pane. */
export function formatSkillDescription(s: Skill): string {
	const bits = [s.category, s.source, s.trust, s.status].filter(Boolean)
	return bits.join(" · ").slice(0, 100)
}
