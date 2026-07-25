/**
 * E11: lean pipeline stages update the persistent footer/status string.
 * Drives the shipped helpers (formatPipelineStage + applyPipelineStageToFooter),
 * not a reimplementation.
 */
import { describe, expect, test } from "bun:test"
import {
	applyPipelineStageToFooter,
	isLeanPipelineFooterMessage,
	pipelineFooterLabelFromStage,
	PIPELINE_FOOTER_KEY,
} from "../src/modes/pipeline-footer.ts"
import { formatPipelineStage, GatewayTurnMapper } from "@omherm/hermes-bridge"

describe("E11 pipeline footer", () => {
	test("pipelineFooterLabelFromStage matches formatPipelineStage (shipped)", () => {
		const ev = {
			stage: "complete",
			open: false,
			text: "[lean-pipeline] complete ■ 842ms iter=2/20",
			ms: 842,
			iter: 2,
			maxIter: 20,
		}
		expect(pipelineFooterLabelFromStage(ev)).toBe(formatPipelineStage(ev))
		expect(pipelineFooterLabelFromStage(ev)).toContain("complete")
		expect(pipelineFooterLabelFromStage(ev)).toContain("842")
	})

	test("applyPipelineStageToFooter updates footer status to recognizable stage", () => {
		const footer = { status: undefined as string | undefined, streaming: false }
		const label = applyPipelineStageToFooter(footer, {
			stage: "policy",
			open: true,
			text: "[lean-pipeline] policy ▶ max_iter=20 provider=xai-oauth",
			provider: "xai-oauth",
			maxIter: 20,
		})
		expect(footer.streaming).toBe(true)
		expect(footer.status).toBe(label)
		expect(footer.status).toMatch(/policy/)
		expect(footer.status).toMatch(/\[lean\]/)
		// last stage retained
		applyPipelineStageToFooter(footer, {
			stage: "complete",
			open: false,
			text: "[lean-pipeline] complete ■ 100ms",
			ms: 100,
		})
		expect(footer.status).toMatch(/complete/)
		expect(footer.status).toMatch(/100/)
	})

	test("mapper working_status is lean-pipeline footer message", () => {
		const m = new GatewayTurnMapper()
		const out = m.feedUi({
			kind: "pipeline_stage",
			stage: "ingress",
			open: true,
			text: "[lean-pipeline] ingress ▶ provider=xai-oauth",
			provider: "xai-oauth",
		})
		const ws = out.find((e) => e.type === "working_status")
		expect(ws && "message" in ws && isLeanPipelineFooterMessage(ws.message)).toBe(true)
		if (ws && "message" in ws) {
			expect(ws.message).toMatch(/ingress|lean/)
		}
	})

	test("PIPELINE_FOOTER_KEY stable for statusLine.setHookStatus", () => {
		expect(PIPELINE_FOOTER_KEY).toBe("lean-pipeline")
	})
})
