import { expect, test } from "bun:test"
import { parseLeanPipelineText } from "./types.ts"
import { formatPipelineStage, GatewayTurnMapper } from "./session-event-map.ts"

test("parseLeanPipelineText open complete with iter", () => {
  const p = parseLeanPipelineText(
    "[lean-pipeline] complete ▶ iter=1/20 mode=anthropic_messages",
  )
  expect(p?.kind).toBe("pipeline_stage")
  expect(p?.stage).toBe("complete")
  expect(p?.open).toBe(true)
  expect(p?.iter).toBe(1)
  expect(p?.maxIter).toBe(20)
})

test("parseLeanPipelineText close with ms", () => {
  const p = parseLeanPipelineText("[lean-pipeline] complete ■ 842ms iter=2/20")
  expect(p?.open).toBe(false)
  expect(p?.ms).toBe(842)
  expect(p?.iter).toBe(2)
})

test("parseLeanPipelineText policy provider", () => {
  const p = parseLeanPipelineText(
    "[lean-pipeline] policy ▶ max_iter=20 provider=minimax-oauth",
  )
  expect(p?.stage).toBe("policy")
  expect(p?.provider).toBe("minimax-oauth")
})

test("formatPipelineStage compact", () => {
  const s = formatPipelineStage({
    stage: "complete",
    open: false,
    text: "x",
    ms: 100,
    iter: 1,
    maxIter: 20,
    provider: "xai-oauth",
  })
  expect(s).toContain("[lean] complete")
  expect(s).toContain("1/20")
  expect(s).toContain("100ms")
})

test("mapper feedUi pipeline_stage → working_status", () => {
  const m = new GatewayTurnMapper({})
  const out = m.feedUi({
    kind: "pipeline_stage",
    stage: "complete",
    open: true,
    text: "[lean-pipeline] complete ▶ iter=1/20",
    iter: 1,
    maxIter: 20,
  })
  expect(out.some((e) => e.type === "working_status")).toBe(true)
})

test("mapGateway lifecycle lean-pipeline → pipeline_stage", async () => {
  const { mapGatewayToUi } = await import("./types.ts")
  const ui = mapGatewayToUi({
    type: "status.update",
    payload: {
      kind: "lifecycle",
      text: "[lean-pipeline] dispatch ▶ tools=2",
    },
  })
  expect(ui && !Array.isArray(ui) && ui.kind === "pipeline_stage").toBe(true)
})
