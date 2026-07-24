/**
 * SessionsPort — thin read façade over `hermes sessions list`.
 * Cadillac: Hermes session store is SoT. UI resume wire is still open
 * (gateway session.list / resume). This port is inventory-only for now.
 */

import { spawn } from "node:child_process"

export type HermesSessionRow = {
	id: string
	title: string
	workspace: string
	lastActive: string
	raw?: string
}

export type SessionsPort = {
	list(opts?: { limit?: number; source?: string; workspace?: string }): Promise<HermesSessionRow[]>
}

function hermesBin(): string {
	return process.env.HERMES_BIN?.trim() || "hermes"
}

type CliResult = { ok: boolean; stdout: string; stderr: string; code: number }

function runSessions(args: string[]): Promise<CliResult> {
	return new Promise((resolve) => {
		const child = spawn(hermesBin(), ["sessions", ...args], {
			env: process.env,
			stdio: ["ignore", "pipe", "pipe"],
		})
		const out: Buffer[] = []
		const err: Buffer[] = []
		child.stdout?.on("data", (d: Buffer) => out.push(d))
		child.stderr?.on("data", (d: Buffer) => err.push(d))
		child.on("error", (e) => {
			resolve({
				ok: false,
				stdout: Buffer.concat(out).toString("utf-8"),
				stderr: e instanceof Error ? e.message : String(e),
				code: 1,
			})
		})
		child.on("close", (code) => {
			resolve({
				ok: code === 0,
				stdout: Buffer.concat(out).toString("utf-8"),
				stderr: Buffer.concat(err).toString("utf-8"),
				code: code ?? 1,
			})
		})
	})
}

/**
 * Parse human table from `hermes sessions list`:
 * Title | Workspace | Last Active | ID
 */
export function parseSessionsListOutput(text: string): HermesSessionRow[] {
	const out: HermesSessionRow[] = []
	for (const line of text.split("\n")) {
		const t = line.trimEnd()
		if (!t.trim()) continue
		if (/^Title\b/i.test(t.trim()) || /^─+/.test(t.trim()) || /^-+$/.test(t.trim())) continue
		// IDs look like 20260724_093153_99e80f at end
		const m = t.match(/^(.*?)\s{2,}(.*?)\s{2,}(.*?)\s{2,}([0-9]{8}_[0-9]{6}_[a-f0-9]+)\s*$/)
		if (m) {
			out.push({
				title: m[1]!.trim() || "—",
				workspace: m[2]!.trim() || "—",
				lastActive: m[3]!.trim() || "—",
				id: m[4]!,
				raw: t,
			})
			continue
		}
		const m2 = t.match(/([0-9]{8}_[0-9]{6}_[a-f0-9]+)\s*$/)
		if (m2) {
			const id = m2[1]!
			const left = t.slice(0, t.length - id.length).trim()
			out.push({
				title: left || "—",
				workspace: "—",
				lastActive: "—",
				id,
				raw: t,
			})
		}
	}
	return out
}

export function createSessionsPort(): SessionsPort {
	return {
		async list(opts = {}) {
			const args = ["list"]
			if (opts.limit != null) args.push("--limit", String(opts.limit))
			if (opts.source) args.push("--source", opts.source)
			if (opts.workspace) args.push("--workspace", opts.workspace)
			const r = await runSessions(args)
			if (!r.ok && !r.stdout.trim()) {
				throw new Error(r.stderr.trim() || `sessions list failed (${r.code})`)
			}
			return parseSessionsListOutput(r.stdout || r.stderr)
		},
	}
}

export const sessionsPort = createSessionsPort()
