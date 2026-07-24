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
	})

	test("exec with args", () => {
		expect(routeHermesSlash("/model gpt")).toEqual({ type: "exec", command: "/model gpt" })
		expect(routeHermesSlash("/kanban list")).toEqual({ type: "exec", command: "/kanban list" })
		expect(routeHermesSlash("/yolo")).toEqual({ type: "exec", command: "/yolo" })
		expect(routeHermesSlash("/some-skill")).toEqual({ type: "exec", command: "/some-skill" })
	})
})
