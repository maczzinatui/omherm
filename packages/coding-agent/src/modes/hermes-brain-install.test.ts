import { describe, expect, test } from "bun:test"
import { shouldAcceptSyntheticPrompt } from "./hermes-brain-install.ts"

describe("shouldAcceptSyntheticPrompt", () => {
	test("non-synthetic prompt passes through", () => {
		const gate = shouldAcceptSyntheticPrompt({ synthetic: false })
		expect(gate.accept).toBe(true)
		expect(gate.notice).toBeUndefined()
	})

	test("non-synthetic with hermesPlanMode passes through (flag is ignored)", () => {
		const gate = shouldAcceptSyntheticPrompt({ synthetic: false, hermesPlanMode: true })
		expect(gate.accept).toBe(true)
		expect(gate.notice).toBeUndefined()
	})

	test("synthetic without hermesPlanMode is rejected loud", () => {
		const gate = shouldAcceptSyntheticPrompt({ synthetic: true })
		expect(gate.accept).toBe(false)
		expect(gate.noticeLevel).toBe("warning")
		expect(gate.notice).toContain("synthetic coat prompts are not ported")
	})

	test("synthetic with hermesPlanMode is accepted + info notice", () => {
		const gate = shouldAcceptSyntheticPrompt({ synthetic: true, hermesPlanMode: true })
		expect(gate.accept).toBe(true)
		expect(gate.noticeLevel).toBe("info")
		expect(gate.notice).toContain("plan-mode approval")
	})

	test("no opts defaults to non-synthetic accept", () => {
		const gate = shouldAcceptSyntheticPrompt({})
		expect(gate.accept).toBe(true)
		expect(gate.notice).toBeUndefined()
	})

	test("hermesPlanMode flag alone does not bypass synthetic guard", () => {
		// Belt-and-suspenders: if someone flips `hermesPlanMode` on without
		// `synthetic`, the gate must remain a no-op. Adding future sibling flags
		// must not silently widen the accept set.
		const gate = shouldAcceptSyntheticPrompt({ hermesPlanMode: true })
		expect(gate.accept).toBe(true)
	})
})
