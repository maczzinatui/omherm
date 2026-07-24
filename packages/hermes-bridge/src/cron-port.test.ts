import { describe, expect, test } from "bun:test"
import {
	formatCronJobLabel,
	normalizeCronJob,
	parseCronListOutput,
	parseCronRunsOutput,
	parseCronStatusOutput,
} from "./cron-port.ts"

describe("cron list parse", () => {
	test("skips headers and empty", () => {
		const text = `
No scheduled jobs.
Create one with 'hermes cron create ...' or the /cron command in chat.
`
		expect(parseCronListOutput(text)).toEqual([])
	})

	test("parses spaced columns", () => {
		const text = `
job_abc1     daily-brief     every 1d     enabled
job_xyz99    watchdog        30m          paused
`
		const jobs = parseCronListOutput(text)
		expect(jobs.length).toBe(2)
		expect(jobs[0].id).toBe("job_abc1")
		expect(jobs[0].name).toContain("daily")
		expect(jobs[1].enabled).toBe(false)
	})
})

describe("cron status parse", () => {
	test("detects running gateway", () => {
		const st = parseCronStatusOutput(
			"✓ Gateway is running — cron jobs will fire automatically\n  PID: 2049\n  Ticker heartbeat: 24s ago\n",
		)
		expect(st.running).toBe(true)
		expect(st.pid).toBe(2049)
		expect(st.heartbeatAge).toContain("24s")
	})
})

describe("cron normalize + runs", () => {
	test("normalize aliases", () => {
		const j = normalizeCronJob({
			job_id: "abc",
			name: "n",
			schedule: "30m",
			enabled: false,
			last_run_at: "t1",
			last_status: "error",
			prompt_preview: "hi",
		})
		expect(j.id).toBe("abc")
		expect(j.enabled).toBe(false)
		expect(j.last_run).toBe("t1")
		expect(j.last_status).toBe("error")
		expect(j.prompt).toBe("hi")
		expect(formatCronJobLabel(j).startsWith("○")).toBe(true)
	})

	test("runs parse keeps lines", () => {
		const rows = parseCronRunsOutput("JOB  TIME\n----\nabc123  ok  1s ago  hello world\n")
		expect(rows.some((r) => r.raw.includes("abc123"))).toBe(true)
		const hit = rows.find((r) => r.raw.includes("abc123"))
		expect(hit?.status).toBe("ok")
		expect(hit?.when).toBeTruthy()
	})
})
