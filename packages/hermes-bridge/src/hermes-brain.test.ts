import { describe, expect, test } from "bun:test"
import { HermesBrain, isHermesBrainEnabled } from "./hermes-brain.ts"

describe("HermesBrain mapper path", () => {
  test("streams a full turn into agent_end and clears streaming", () => {
    const brain = new HermesBrain({ turnTimeoutMs: 5_000 })
    const types: string[] = []
    brain.subscribe((e) => types.push(e.type))

    brain.feedUiForTest({ kind: "info", info: { model: "test-model", provider: "xai" } })
    brain.feedUiForTest({ kind: "thinking", text: "why " })
    brain.feedUiForTest({ kind: "thinking", text: "ok", done: true })
    brain.feedUiForTest({ kind: "text", text: "hi" })
    brain.feedUiForTest({ kind: "text", text: "hi", done: true })
    brain.feedUiForTest({ kind: "turn_end", usage: { input_tokens: 1, output_tokens: 1 } })

    expect(types).toContain("agent_start")
    expect(types).toContain("message_update")
    expect(types).toContain("agent_end")
    expect(brain.streaming).toBe(false)
  })

  test("tool lifecycle maps", () => {
    const brain = new HermesBrain()
    const names: string[] = []
    brain.subscribe((e) => {
      if (e.type === "tool_execution_start") names.push(e.toolName)
    })
    brain.feedUiForTest({
      kind: "tool_start",
      id: "1",
      name: "terminal",
      args: '{"command":"echo"}',
    })
    brain.feedUiForTest({ kind: "tool_end", id: "1", name: "terminal", summary: "ok" })
    brain.feedUiForTest({ kind: "turn_end" })
    expect(names).toEqual(["terminal"])
  })

  test("dispose mid-stream emits notice + agent_end before killing listeners", () => {
    const brain = new HermesBrain()
    const types: string[] = []
    brain.subscribe((e) => types.push(e.type))
    // Open a mapped turn so forceEnd has something to seal.
    brain.feedUiForTest({ kind: "text", text: "partial" })
    expect(brain.streaming).toBe(true)
    brain.dispose()
    expect(types).toContain("notice")
    expect(types).toContain("agent_end")
    expect(brain.streaming).toBe(false)
  })
})

describe("isHermesBrainEnabled", () => {
  test("respects OMP brain escape hatch", () => {
    const prev = { ...process.env }
    try {
      process.env.MESHINA_TUI_BRAND = "hermes"
      delete process.env.MESHINA_TUI_HERMES_BRAIN
      delete process.env.MESHINA_TUI_OMP_BRAIN
      expect(isHermesBrainEnabled()).toBe(true)

      process.env.MESHINA_TUI_OMP_BRAIN = "1"
      expect(isHermesBrainEnabled()).toBe(false)
    } finally {
      process.env.MESHINA_TUI_BRAND = prev.MESHINA_TUI_BRAND
      process.env.MESHINA_TUI_HERMES_BRAIN = prev.MESHINA_TUI_HERMES_BRAIN
      process.env.MESHINA_TUI_OMP_BRAIN = prev.MESHINA_TUI_OMP_BRAIN
    }
  })
})
