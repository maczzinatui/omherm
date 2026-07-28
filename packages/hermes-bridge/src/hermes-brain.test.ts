import { describe, expect, test } from "bun:test"
import { HermesBrain, isHermesBrainEnabled } from "./hermes-brain.ts"

describe("HermesBrain mapper path", () => {
  test("isStreaming is false when agent_end listeners run", () => {
    // Regression: flag was cleared after emit → coat skipped agent_end teardown
    // (title spinner / Working never stopped).
    const brain = new HermesBrain()
    let streamingAtAgentEnd: boolean | undefined
    brain.subscribe((e) => {
      if (e.type === "agent_end") {
        streamingAtAgentEnd = brain.streaming
      }
    })
    brain.feedUiForTest({ kind: "text", text: "hi" })
    brain.feedUiForTest({ kind: "text", text: "hi", done: true })
    brain.feedUiForTest({ kind: "turn_end", usage: { output_tokens: 1 } })
    expect(streamingAtAgentEnd).toBe(false)
    expect(brain.streaming).toBe(false)
  })

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

describe("HermesBrain dialog host (approvals + clarify)", () => {
  test("approval event calls host.approval and approval.respond (not silent)", async () => {
    const responded: string[] = []
    const gateway = {
      ready: true,
      sessionInfo: {},
      sessionId: null,
      onUi: () => () => {},
      bootstrap: async () => ({}),
      kill: () => {},
      respondApproval: async (choice: string) => {
        responded.push(choice)
      },
      respondClarify: async () => {},
    } as unknown as import("./client.ts").HermesGateway

    const brain = new HermesBrain({ gateway })
    const notices: string[] = []
    brain.subscribe((e) => {
      if (e.type === "notice") notices.push(String((e as { message?: string }).message ?? ""))
    })

    let approvalCalled = false
    brain.setDialogHost({
      clarify: async () => "",
      approval: async (req) => {
        approvalCalled = true
        expect(req.command).toBe("rm -rf /tmp/x")
        expect(req.choices?.length).toBeGreaterThan(0)
        return "once"
      },
    })

    brain.feedUiForTest({
      kind: "approval",
      command: "rm -rf /tmp/x",
      description: "destructive",
      choices: ["once", "session", "always", "deny"],
    } as import("./types.ts").UiEvent)

    // dialog is async
    await new Promise((r) => setTimeout(r, 30))
    expect(approvalCalled).toBe(true)
    expect(responded).toEqual(["once"])
    expect(notices.some((n) => n.includes("Approval:"))).toBe(true)
  })

  test("clarify event calls host.clarify and clarify.respond", async () => {
    const answers: Array<{ id: string; answer: string }> = []
    const gateway = {
      ready: true,
      sessionInfo: {},
      sessionId: null,
      onUi: () => () => {},
      bootstrap: async () => ({}),
      kill: () => {},
      respondApproval: async () => {},
      respondClarify: async (id: string, answer: string) => {
        answers.push({ id, answer })
      },
    } as unknown as import("./client.ts").HermesGateway

    const brain = new HermesBrain({ gateway })
    brain.setDialogHost({
      clarify: async (req) => {
        expect(req.question).toContain("which board")
        return "default"
      },
      approval: async () => "deny",
    })

    brain.feedUiForTest({
      kind: "clarify",
      id: "c-1",
      question: "which board?",
      choices: ["default", "mesh"],
    } as import("./types.ts").UiEvent)

    await new Promise((r) => setTimeout(r, 30))
    expect(answers).toEqual([{ id: "c-1", answer: "default" }])
  })

  test("approval without dialog host does not call gateway (no silent auto-deny)", async () => {
    const responded: string[] = []
    const gateway = {
      ready: true,
      sessionInfo: {},
      sessionId: null,
      onUi: () => () => {},
      bootstrap: async () => ({}),
      kill: () => {},
      respondApproval: async (choice: string) => {
        responded.push(choice)
      },
      respondClarify: async () => {},
    } as unknown as import("./client.ts").HermesGateway

    const brain = new HermesBrain({ gateway })
    // no setDialogHost
    brain.feedUiForTest({
      kind: "approval",
      command: "echo hi",
      description: "safe",
    } as import("./types.ts").UiEvent)

    await new Promise((r) => setTimeout(r, 20))
    expect(responded).toEqual([])
  })
})
