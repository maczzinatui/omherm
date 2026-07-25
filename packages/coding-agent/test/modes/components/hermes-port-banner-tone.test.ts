import { describe, expect, test } from "bun:test"
import { hermesPortBannerTone } from "../../../src/modes/components/hermes-port-list.ts"

describe("hermesPortBannerTone (port death fail-loud)", () => {
	test("CLI/port failure paints warning, not accent", () => {
		expect(hermesPortBannerTone(true, "hermes kanban list failed (127)")).toBe("warning")
	})

	test("success banner stays accent", () => {
		expect(hermesPortBannerTone(false, "Runs refreshed")).toBe("accent")
	})

	test("empty error text does not force warning", () => {
		expect(hermesPortBannerTone(true, "")).toBe("accent")
	})
})
