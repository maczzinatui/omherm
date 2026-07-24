/**
 * KanbanPort — board DTO façade. Writes only via `hermes kanban` CLI.
 * Prefer --json reads. See docs/KANBAN_PORT.md.
 */

import { spawn } from "node:child_process"

export type KanbanTask = {
	id: string
	title: string
	status: string
	assignee: string | null
	priority?: number | null
	body?: string | null
	tenant?: string | null
	created_at?: number | null
	raw?: string
}

export type KanbanDetail = KanbanTask & {
	showText: string
	json?: Record<string, unknown>
}

export type KanbanCreateInput = {
	title: string
	body?: string
	assignee?: string
	priority?: number
	triage?: boolean
	parent?: string
	workspace?: string
	skills?: string[]
	board?: string
}

export type KanbanPort = {
	list(opts?: {
		status?: string
		limit?: number
		board?: string
		mine?: boolean
		archived?: boolean
	}): Promise<KanbanTask[]>
	show(id: string, board?: string): Promise<KanbanDetail>
	create(input: KanbanCreateInput): Promise<string>
	complete(ids: string[], board?: string): Promise<string>
	block(ids: string[], board?: string): Promise<string>
	unblock(ids: string[], board?: string): Promise<string>
	promote(ids: string[], board?: string): Promise<string>
	archive(ids: string[], board?: string): Promise<string>
	assign(id: string, assignee: string, board?: string): Promise<string>
	comment(id: string, text: string, board?: string): Promise<string>
	stats(board?: string): Promise<string>
}

function hermesBin(): string {
	return process.env.HERMES_BIN?.trim() || "hermes"
}

type CliResult = { ok: boolean; stdout: string; stderr: string; code: number }

/** Async CLI — never spawnSync on the TUI event loop (blocks mouse/paint). */
function runKanban(args: string[]): Promise<CliResult> {
	return new Promise((resolve) => {
		const child = spawn(hermesBin(), ["kanban", ...args], {
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

function withBoard(args: string[], board?: string): string[] {
	return board ? ["--board", board, ...args] : args
}

export function mapKanbanJsonRow(row: Record<string, unknown>): KanbanTask {
	const assignee = row.assignee
	return {
		id: String(row.id ?? ""),
		title: String(row.title ?? ""),
		status: String(row.status ?? "unknown"),
		assignee: assignee == null || assignee === "" ? null : String(assignee),
		priority: typeof row.priority === "number" ? row.priority : row.priority != null ? Number(row.priority) : null,
		body: row.body != null ? String(row.body) : null,
		tenant: row.tenant != null ? String(row.tenant) : null,
		created_at: typeof row.created_at === "number" ? row.created_at : null,
	}
}

/** Parse `hermes kanban list` human lines into DTOs (fallback). */
export function parseKanbanListOutput(text: string): KanbanTask[] {
	const out: KanbanTask[] = []
	for (const line of text.split("\n")) {
		const m = line.match(/(t_[a-f0-9]{8,})\s+(\S+)\s+\(([^)]*)\)\s+(.*)$/i)
		if (!m) continue
		const assignee = m[3].trim()
		out.push({
			id: m[1],
			status: m[2],
			assignee: !assignee || assignee === "unassigned" ? null : assignee,
			title: m[4].trim(),
			raw: line.trim(),
		})
	}
	return out
}

export function parseKanbanListJson(text: string): KanbanTask[] {
	const t = text.trim()
	if (!t.startsWith("[") && !t.startsWith("{")) return []
	try {
		const data = JSON.parse(t) as unknown
		const rows = Array.isArray(data) ? data : Array.isArray((data as { tasks?: unknown }).tasks) ? (data as { tasks: unknown[] }).tasks : []
		return rows
			.filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
			.map(mapKanbanJsonRow)
			.filter((t) => t.id)
	} catch {
		return []
	}
}

export function createKanbanPort(): KanbanPort {
	return {
		async list(opts = {}) {
			const args = withBoard(["list", "--json"], opts.board)
			if (opts.status) args.push("--status", opts.status)
			if (opts.mine) args.push("--mine")
			if (opts.archived) args.push("--archived")
			const r = await runKanban(args)
			if (!r.ok && !r.stdout.trim()) {
				// fallback human list
				const h = await runKanban(withBoard(["list"], opts.board))
				if (!h.ok && !h.stdout.trim()) {
					throw new Error(r.stderr.trim() || h.stderr.trim() || `hermes kanban list failed (${r.code})`)
				}
				let parsed = parseKanbanListOutput(h.stdout)
				if (opts.status) parsed = parsed.filter((t) => t.status === opts.status)
				if (opts.limit) parsed = parsed.slice(0, opts.limit)
				return parsed
			}
			let parsed = parseKanbanListJson(r.stdout)
			if (parsed.length === 0) parsed = parseKanbanListOutput(r.stdout)
			if (opts.status) parsed = parsed.filter((t) => t.status === opts.status)
			if (opts.limit) parsed = parsed.slice(0, opts.limit)
			return parsed
		},

		async show(id, board) {
			const args = withBoard(["show", id, "--json"], board)
			const r = await runKanban(args)
			if (r.ok && r.stdout.trim().startsWith("{")) {
				try {
					const parsed = JSON.parse(r.stdout) as Record<string, unknown>
					const json =
						parsed.task && typeof parsed.task === "object"
							? (parsed.task as Record<string, unknown>)
							: parsed
					const base = mapKanbanJsonRow(json)
					if (!base.id) base.id = id
					return { ...base, showText: r.stdout, json }
				} catch {
					/* fall through */
				}
			}
			const h = await runKanban(withBoard(["show", id], board))
			if (!h.ok) throw new Error(h.stderr.trim() || r.stderr.trim() || `hermes kanban show failed (${h.code})`)
			const text = h.stdout
			const listGuess = parseKanbanListOutput(text)
			const base =
				listGuess[0] ||
				({
					id,
					title: id,
					status: "unknown",
					assignee: null,
				} satisfies KanbanTask)
			return { ...base, showText: text }
		},

		async create(input) {
			const args = withBoard(["create", "--json", input.title], input.board)
			if (input.body) args.push("--body", input.body)
			if (input.assignee) args.push("--assignee", input.assignee)
			if (input.priority != null) args.push("--priority", String(input.priority))
			if (input.triage) args.push("--triage")
			if (input.parent) args.push("--parent", input.parent)
			if (input.workspace) args.push("--workspace", input.workspace)
			for (const s of input.skills || []) args.push("--skill", s)
			const r = await runKanban(args)
			if (!r.ok) throw new Error(r.stderr.trim() || r.stdout.trim() || `create failed (${r.code})`)
			return (r.stdout || r.stderr).trim()
		},

		async complete(ids, board) {
			const args = withBoard(["complete", ...ids], board)
			const r = await runKanban(args)
			if (!r.ok) throw new Error(r.stderr.trim() || r.stdout.trim() || `complete failed (${r.code})`)
			return (r.stdout || r.stderr).trim()
		},

		async block(ids, board) {
			const r = await runKanban(withBoard(["block", ...ids], board))
			if (!r.ok) throw new Error(r.stderr.trim() || r.stdout.trim() || `block failed (${r.code})`)
			return (r.stdout || r.stderr).trim()
		},

		async unblock(ids, board) {
			const r = await runKanban(withBoard(["unblock", ...ids], board))
			if (!r.ok) throw new Error(r.stderr.trim() || r.stdout.trim() || `unblock failed (${r.code})`)
			return (r.stdout || r.stderr).trim()
		},

		async promote(ids, board) {
			const r = await runKanban(withBoard(["promote", ...ids], board))
			if (!r.ok) throw new Error(r.stderr.trim() || r.stdout.trim() || `promote failed (${r.code})`)
			return (r.stdout || r.stderr).trim()
		},

		async archive(ids, board) {
			const r = await runKanban(withBoard(["archive", ...ids], board))
			if (!r.ok) throw new Error(r.stderr.trim() || r.stdout.trim() || `archive failed (${r.code})`)
			return (r.stdout || r.stderr).trim()
		},

		async assign(id, assignee, board) {
			const r = await runKanban(withBoard(["assign", id, assignee], board))
			if (!r.ok) throw new Error(r.stderr.trim() || r.stdout.trim() || `assign failed (${r.code})`)
			return (r.stdout || r.stderr).trim()
		},

		async comment(id, text, board) {
			const r = await runKanban(withBoard(["comment", id, text], board))
			if (!r.ok) throw new Error(r.stderr.trim() || r.stdout.trim() || `comment failed (${r.code})`)
			return (r.stdout || r.stderr).trim()
		},

		async stats(board) {
			const r = await runKanban(withBoard(["stats"], board))
			if (!r.ok && !r.stdout.trim()) throw new Error(r.stderr.trim() || `stats failed (${r.code})`)
			return (r.stdout || r.stderr).trim()
		},
	}
}

export const kanbanPort = createKanbanPort()

export function formatKanbanLabel(t: KanbanTask): string {
	const st = t.status.padEnd(10).slice(0, 10)
	return `${st} ${t.id}`
}

export function formatKanbanDescription(t: KanbanTask): string {
	const who = t.assignee || "unassigned"
	const pr = t.priority != null ? `p${t.priority}` : null
	return [t.title.slice(0, 60), who, pr].filter(Boolean).join(" · ").slice(0, 100)
}
