/**
 * CronPort — scheduler façade. CLI is contract harness; jobs.json is optional
 * rich-read when present (Hermes home — not a twin store). See docs/CRON_PORT.md.
 */

import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

/** Herm-normalized job DTO (UI binds only this). */
export type CronJob = {
	id: string
	name: string
	prompt: string
	schedule: string
	enabled: boolean
	state: string
	deliver: string
	repeat?: string | number
	last_run?: string
	next_run?: string
	last_status?: "ok" | "error"
	last_error?: string
	paused_reason?: string
	provider?: string
	model?: string
	base_url?: string
	no_agent?: boolean
	attach_to_session?: boolean
	skills?: string[]
	context_from?: string[]
	enabled_toolsets?: string[]
	workdir?: string
	script?: string
	/** Original CLI line when parsed from text list */
	raw?: string
}

export type CronSchedulerStatus = {
	running: boolean
	pid?: number
	heartbeatAge?: string
	summary: string
	raw: string
}

export type CronRunRow = {
	raw: string
	job_id?: string
}

export type CronCreateInput = {
	schedule: string
	prompt?: string
	name?: string
	deliver?: string
	repeat?: number
	skills?: string[]
	script?: string
	no_agent?: boolean
	workdir?: string
}

export type CronEditInput = {
	schedule?: string
	prompt?: string
	name?: string
	deliver?: string
	repeat?: number
	script?: string
	no_agent?: boolean
	agent?: boolean
	workdir?: string
	skills?: string[]
	add_skills?: string[]
	remove_skills?: string[]
	clear_skills?: boolean
}

export type CronPort = {
	list(opts?: { all?: boolean }): Promise<CronJob[]>
	status(): Promise<CronSchedulerStatus>
	pause(jobId: string): Promise<string>
	resume(jobId: string): Promise<string>
	run(jobId: string): Promise<string>
	remove(jobId: string): Promise<string>
	create(input: CronCreateInput): Promise<string>
	edit(jobId: string, input: CronEditInput): Promise<string>
	runs(jobId?: string, limit?: number): Promise<CronRunRow[]>
	/** Best-effort detail: jobs.json row if present, else list match */
	show(jobId: string): Promise<CronJob | null>
}

function hermesBin(): string {
	return process.env.HERMES_BIN?.trim() || "hermes"
}

function hermesHome(): string {
	return process.env.HERMES_HOME?.trim() || join(homedir(), ".hermes")
}

function runCron(args: string[]): { ok: boolean; stdout: string; stderr: string; code: number } {
	const r = spawnSync(hermesBin(), ["cron", ...args], {
		encoding: "utf-8",
		maxBuffer: 8 * 1024 * 1024,
		env: { ...process.env, HERMES_ACCEPT_HOOKS: process.env.HERMES_ACCEPT_HOOKS || "1" },
	})
	return {
		ok: r.status === 0,
		stdout: r.stdout || "",
		stderr: r.stderr || "",
		code: r.status ?? 1,
	}
}

function asArr(v: unknown): string[] | undefined {
	if (Array.isArray(v)) return v.map(String).filter(Boolean)
	if (typeof v === "string" && v.trim()) return v.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
	return undefined
}

/** Normalize gateway/jobs.json/CLI-ish raw → CronJob */
export function normalizeCronJob(j: Record<string, unknown>, rawLine?: string): CronJob {
	const last = j.last_status
	const last_status = last === "ok" || last === "error" ? last : undefined
	const id = String(j.job_id ?? j.id ?? "").trim()
	return {
		id,
		name: String(j.name ?? ""),
		prompt: String(j.prompt ?? j.prompt_preview ?? ""),
		schedule: String(j.schedule ?? ""),
		enabled: j.enabled === undefined || j.enabled === null ? true : Boolean(j.enabled),
		state: String(j.state ?? (j.enabled === false ? "paused" : "scheduled")),
		deliver: String(j.deliver ?? "local"),
		repeat: (j.repeat as string | number | undefined) ?? undefined,
		last_run: j.last_run_at != null ? String(j.last_run_at) : j.last_run != null ? String(j.last_run) : undefined,
		next_run: j.next_run_at != null ? String(j.next_run_at) : j.next_run != null ? String(j.next_run) : undefined,
		last_status,
		last_error: j.last_delivery_error != null ? String(j.last_delivery_error) : j.last_error != null ? String(j.last_error) : undefined,
		paused_reason: j.paused_reason != null ? String(j.paused_reason) : undefined,
		provider: j.provider != null ? String(j.provider) : undefined,
		model: j.model != null ? String(j.model) : undefined,
		base_url: j.base_url != null ? String(j.base_url) : undefined,
		no_agent: j.no_agent != null ? Boolean(j.no_agent) : undefined,
		attach_to_session: j.attach_to_session != null ? Boolean(j.attach_to_session) : undefined,
		skills: asArr(j.skills),
		context_from: asArr(j.context_from),
		enabled_toolsets: asArr(j.enabled_toolsets),
		workdir: j.workdir != null ? String(j.workdir) : undefined,
		script: j.script != null ? String(j.script) : undefined,
		raw: rawLine,
	}
}

/** Parse `hermes cron list` human lines into DTOs */
export function parseCronListOutput(text: string): CronJob[] {
	const out: CronJob[] = []
	for (const line of text.split("\n")) {
		const t = line.trim()
		if (!t || t.startsWith("NAME") || t.startsWith("---")) continue
		if (/no (scheduled |active )?jobs/i.test(t)) continue
		if (/create one with/i.test(t)) continue
		if (/^✓|^Gateway|^PID:|^Ticker/i.test(t)) continue

		// Common: id  name  schedule  …
		const parts = t.split(/\s{2,}|\t+/).filter(Boolean)
		if (parts.length === 0) continue

		// Leading glyph ●/○/▶ optional
		let p0 = parts[0]
		if (/^[●○▶✓✗·•]$/.test(p0) && parts.length > 1) {
			parts.shift()
			p0 = parts[0]
		}

		const id = p0
		if (!id || id.length < 4) continue
		if (!/^[a-zA-Z0-9_-]+$/.test(id)) continue

		const enabled = !/pause|disabled|\boff\b|○/i.test(t)
		const schedule =
			parts.find((p) => /^(every\s|@|\d+[smhd]|[\d*,/-]+\s+[\d*,/-]+)/i.test(p)) ||
			parts[2] ||
			null
		const name = parts[1] && parts[1] !== schedule ? parts[1] : ""

		out.push(
			normalizeCronJob(
				{
					id,
					name,
					schedule: schedule || "",
					enabled,
					state: enabled ? "scheduled" : "paused",
					prompt: "",
					deliver: "local",
				},
				t,
			),
		)
	}
	return out
}

export function parseCronStatusOutput(text: string): CronSchedulerStatus {
	const running = /gateway is running|ticker|cron jobs will fire/i.test(text) && !/not running|stopped|inactive/i.test(text.split("\n")[0] || "")
	const pidM = text.match(/PID:\s*(\d+)/i)
	const hbM = text.match(/[Hh]eartbeat:\s*([^\n]+)/)
	// Prefer explicit ✓ line
	const okLine = /✓\s*Gateway is running/i.test(text)
	return {
		running: okLine || running,
		pid: pidM ? Number(pidM[1]) : undefined,
		heartbeatAge: hbM ? hbM[1].trim() : undefined,
		summary: text.trim().split("\n").slice(0, 4).join(" · ").slice(0, 200),
		raw: text,
	}
}

export function parseCronRunsOutput(text: string): CronRunRow[] {
	const out: CronRunRow[] = []
	for (const line of text.split("\n")) {
		const t = line.trim()
		if (!t || /^JOB|^---|^id\b/i.test(t)) continue
		if (/no (runs|history|attempts)/i.test(t)) continue
		const idM = t.match(/\b([a-f0-9-]{8,})\b/i)
		out.push({ raw: t, job_id: idM?.[1] })
	}
	return out
}

function readJobsJson(): CronJob[] {
	const path = join(hermesHome(), "cron", "jobs.json")
	if (!existsSync(path)) return []
	try {
		const data = JSON.parse(readFileSync(path, "utf-8")) as { jobs?: unknown[] }
		const jobs = Array.isArray(data.jobs) ? data.jobs : Array.isArray(data) ? data : []
		return jobs
			.filter((j): j is Record<string, unknown> => !!j && typeof j === "object")
			.map((j) => normalizeCronJob(j))
			.filter((j) => j.id)
	} catch {
		return []
	}
}

function mergeJob(cli: CronJob | undefined, file: CronJob | undefined): CronJob | null {
	if (!cli && !file) return null
	if (!cli) return file!
	if (!file) return cli
	return {
		...file,
		...cli,
		// Prefer richer file fields when CLI sparse
		prompt: cli.prompt || file.prompt,
		name: cli.name || file.name,
		schedule: cli.schedule || file.schedule,
		deliver: cli.deliver || file.deliver,
		skills: cli.skills?.length ? cli.skills : file.skills,
		script: cli.script || file.script,
		workdir: cli.workdir || file.workdir,
		last_run: cli.last_run || file.last_run,
		next_run: cli.next_run || file.next_run,
		raw: cli.raw || file.raw,
	}
}

export function createCronPort(): CronPort {
	return {
		async list(opts = {}) {
			const args = ["list"]
			if (opts.all) args.push("--all")
			const r = runCron(args)
			if (!r.ok && !r.stdout.trim()) {
				throw new Error(r.stderr.trim() || `hermes cron list failed (${r.code})`)
			}
			const fromCli = parseCronListOutput(r.stdout)
			const fromFile = readJobsJson()
			if (fromFile.length === 0) return fromCli

			// Merge by id — file wins on detail, CLI wins on enabled if present
			const map = new Map<string, CronJob>()
			for (const j of fromFile) map.set(j.id, j)
			for (const j of fromCli) {
				map.set(j.id, mergeJob(j, map.get(j.id))!)
			}
			// If CLI empty but file has jobs (list format drift), show file
			if (fromCli.length === 0 && fromFile.length > 0) {
				return opts.all ? fromFile : fromFile.filter((j) => j.enabled)
			}
			return [...map.values()]
		},

		async show(jobId) {
			const id = jobId.trim()
			const file = readJobsJson().find((j) => j.id === id)
			const all = await this.list({ all: true }).catch(() => [] as CronJob[])
			const cli = all.find((j) => j.id === id)
			return mergeJob(cli, file)
		},

		async status() {
			const r = runCron(["status"])
			const text = (r.stdout || r.stderr || "").trim() || `cron status exit ${r.code}`
			return parseCronStatusOutput(text)
		},

		async pause(jobId) {
			const r = runCron(["pause", jobId])
			if (!r.ok) throw new Error(r.stderr.trim() || r.stdout.trim() || `pause failed (${r.code})`)
			return (r.stdout || r.stderr).trim()
		},

		async resume(jobId) {
			const r = runCron(["resume", jobId])
			if (!r.ok) throw new Error(r.stderr.trim() || r.stdout.trim() || `resume failed (${r.code})`)
			return (r.stdout || r.stderr).trim()
		},

		async run(jobId) {
			const r = runCron(["run", jobId])
			if (!r.ok) throw new Error(r.stderr.trim() || r.stdout.trim() || `run failed (${r.code})`)
			return (r.stdout || r.stderr).trim()
		},

		async remove(jobId) {
			const r = runCron(["remove", jobId])
			if (!r.ok) throw new Error(r.stderr.trim() || r.stdout.trim() || `remove failed (${r.code})`)
			return (r.stdout || r.stderr).trim()
		},

		async create(input) {
			const args = ["create"]
			if (input.name) args.push("--name", input.name)
			if (input.deliver) args.push("--deliver", input.deliver)
			if (input.repeat != null) args.push("--repeat", String(input.repeat))
			if (input.script) args.push("--script", input.script)
			if (input.no_agent) args.push("--no-agent")
			if (input.workdir) args.push("--workdir", input.workdir)
			for (const s of input.skills || []) args.push("--skill", s)
			args.push(input.schedule)
			if (input.prompt) args.push(input.prompt)
			const r = runCron(args)
			if (!r.ok) throw new Error(r.stderr.trim() || r.stdout.trim() || `create failed (${r.code})`)
			return (r.stdout || r.stderr).trim()
		},

		async edit(jobId, input) {
			const args = ["edit", jobId]
			if (input.schedule != null) args.push("--schedule", input.schedule)
			if (input.prompt != null) args.push("--prompt", input.prompt)
			if (input.name != null) args.push("--name", input.name)
			if (input.deliver != null) args.push("--deliver", input.deliver)
			if (input.repeat != null) args.push("--repeat", String(input.repeat))
			if (input.script != null) args.push("--script", input.script)
			if (input.no_agent) args.push("--no-agent")
			if (input.agent) args.push("--agent")
			if (input.workdir != null) args.push("--workdir", input.workdir)
			if (input.clear_skills) args.push("--clear-skills")
			for (const s of input.skills || []) args.push("--skill", s)
			for (const s of input.add_skills || []) args.push("--add-skill", s)
			for (const s of input.remove_skills || []) args.push("--remove-skill", s)
			const r = runCron(args)
			if (!r.ok) throw new Error(r.stderr.trim() || r.stdout.trim() || `edit failed (${r.code})`)
			return (r.stdout || r.stderr).trim()
		},

		async runs(jobId, limit = 20) {
			const args = ["runs"]
			if (jobId) args.push(jobId)
			if (limit) args.push("--limit", String(limit))
			const r = runCron(args)
			if (!r.ok && !r.stdout.trim()) {
				throw new Error(r.stderr.trim() || `runs failed (${r.code})`)
			}
			return parseCronRunsOutput(r.stdout || "")
		},
	}
}

export const cronPort = createCronPort()

/** One-line label for list UI */
export function formatCronJobLabel(j: CronJob): string {
	const mark = j.enabled ? "●" : "○"
	const st = j.last_status === "error" ? "!" : j.last_status === "ok" ? "✓" : " "
	const name = (j.name || j.id).slice(0, 40)
	return `${mark}${st} ${name}`
}

export function formatCronJobDescription(j: CronJob): string {
	const bits = [
		j.schedule || "?",
		j.deliver,
		j.next_run ? `next ${j.next_run}` : null,
		j.last_run ? `last ${j.last_run}` : null,
		j.no_agent ? "no-agent" : null,
	].filter(Boolean)
	return bits.join(" · ").slice(0, 100)
}
