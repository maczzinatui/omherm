import { describe, expect, test } from "bun:test"
import { parseHermesSlashLine, routeHermesSlash } from "./hermes-slash-router.ts"

describe("hermes slash router", () => {
	test("parse", () => {
		expect(parseHermesSlashLine("/kanban")).toEqual({ name: "kanban", rest: "", raw: "/kanban" })
		expect(parseHermesSlashLine("/model foo")).toEqual({ name: "model", rest: "foo", raw: "/model foo" })
		expect(parseHermesSlashLine("nope")).toBeNull()
	})

	test("deep links", () => {
		expect(routeHermesSlash("/settings")).toEqual({ type: "settings" })
		expect(routeHermesSlash("/model")).toEqual({ type: "model" })
		expect(routeHermesSlash("/kanban")).toEqual({ type: "port", port: "kanban" })
		expect(routeHermesSlash("/cron")).toEqual({ type: "port", port: "cron" })
		expect(routeHermesSlash("/profile")).toEqual({ type: "port", port: "profiles" })
		expect(routeHermesSlash("/skills")).toEqual({ type: "port", port: "skills" })
		expect(routeHermesSlash("/tools")).toEqual({ type: "port", port: "tools" })
		expect(routeHermesSlash("/memory")).toEqual({ type: "port", port: "memory" })
		expect(routeHermesSlash("/subagents")).toEqual({ type: "port", port: "subagents" })
		expect(routeHermesSlash("/sessions")).toEqual({ type: "port", port: "sessions" })
		expect(routeHermesSlash("/resume")).toEqual({ type: "port", port: "sessions" })
		expect(routeHermesSlash("/lean-profile")).toEqual({ type: "port", port: "lean-profile" })
		expect(routeHermesSlash("/lean")).toEqual({ type: "port", port: "lean-profile" })
		expect(routeHermesSlash("/library")).toEqual({ type: "port", port: "library" })
		expect(routeHermesSlash("/docs")).toEqual({ type: "port", port: "library" })
		expect(routeHermesSlash("/docs-search")).toEqual({ type: "port", port: "library" })
	})

	test("exec with args", () => {
		expect(routeHermesSlash("/model gpt")).toEqual({ type: "exec", command: "/model gpt" })
		expect(routeHermesSlash("/kanban list")).toEqual({ type: "exec", command: "/kanban list" })
		expect(routeHermesSlash("/skills list")).toEqual({ type: "exec", command: "/skills list" })
		expect(routeHermesSlash("/tools enable web")).toEqual({ type: "exec", command: "/tools enable web" })
		expect(routeHermesSlash("/yolo")).toEqual({ type: "exec", command: "/yolo" })
		expect(routeHermesSlash("/compress")).toEqual({ type: "exec", command: "/compress" })
		expect(routeHermesSlash("/goal")).toEqual({ type: "exec", command: "/goal" })
		expect(routeHermesSlash("/browser")).toEqual({ type: "exec", command: "/browser" })
		expect(routeHermesSlash("/resume abc")).toEqual({ type: "exec", command: "/resume abc" })
		expect(routeHermesSlash("/some-skill")).toEqual({ type: "exec", command: "/some-skill" })
	})
})
