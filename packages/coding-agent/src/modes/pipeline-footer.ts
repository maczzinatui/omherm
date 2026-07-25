/**
 * E11 — lean pipeline stage → persistent footer / status-line strip.
 *
 * Brain already emits [lean-pipeline] stages; hermes-bridge maps them to
 * working_status + pipeline_stage. This helper decides what the coat paints
 * as the durable footer label (current or last stage).
 */

import { formatPipelineStage } from "@omherm/hermes-bridge"

export const PIPELINE_FOOTER_KEY = "lean-pipeline"

/** True when a working_status / notice string is a lean pipeline label. */
export function isLeanPipelineFooterMessage(message: string | undefined | null): boolean {
	const m = String(message || "")
	return m.includes("[lean]") || m.includes("[lean-pipeline]") || m.includes("lean-pipeline")
}

/**
 * Resolve the footer string for a pipeline_stage UiEvent-shaped object.
 * Pure — unit-tested so E11 does not depend on a live TUI paint.
 */
export function pipelineFooterLabelFromStage(ev: {
	stage: string
	open: boolean
	text: string
	iter?: number
	maxIter?: number
	ms?: number
	provider?: string
}): string {
	return formatPipelineStage(ev)
}

/**
 * Apply stage to a minimal footer sink (status strip). Keeps last stage
 * when `clear` is false (default) — callers clear on next user turn.
 */
export function applyPipelineStageToFooter(
	sink: { status?: string; streaming?: boolean },
	ev: {
		stage: string
		open: boolean
		text: string
		iter?: number
		maxIter?: number
		ms?: number
		provider?: string
	},
	opts?: { streaming?: boolean },
): string {
	const label = pipelineFooterLabelFromStage(ev)
	sink.status = label
	if (opts?.streaming !== false) sink.streaming = true
	return label
}
