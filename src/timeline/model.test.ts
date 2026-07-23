import { describe, expect, test } from "bun:test"
import { applyEvent, formatFooter, initialState, pushUser } from "./model"

describe("timeline reducer", () => {
  test("thinking + tool + text turn", () => {
    let s = initialState()
    s = applyEvent(s, { type: "gateway.ready", payload: {} })
    s = applyEvent(s, {
      type: "session.info",
      payload: {
        model: "Qwopus",
        cwd: "/tmp",
        session_id: "abc12345ffff",
        tools: { core: ["terminal"] },
        skills: { devops: ["goal-plan"] },
      },
    })
    s = pushUser(s, "hi")
    s = applyEvent(s, { type: "thinking.delta", payload: { text: "plan " } })
    s = applyEvent(s, { type: "thinking.delta", payload: { text: "it" } })
    s = applyEvent(s, {
      type: "tool.start",
      payload: { tool_id: "t1", name: "terminal", args_text: "date" },
    })
    s = applyEvent(s, {
      type: "tool.complete",
      payload: { tool_id: "t1", name: "terminal", summary: "ok" },
    })
    s = applyEvent(s, { type: "message.start" })
    s = applyEvent(s, { type: "message.delta", payload: { text: "Hello" } })
    s = applyEvent(s, {
      type: "message.complete",
      payload: { text: "Hello", status: "complete" },
    })

    const kinds = s.segments.map((x) => x.kind)
    expect(kinds).toContain("thinking")
    expect(kinds).toContain("tool")
    expect(kinds).toContain("text")
    expect(kinds).toContain("user")

    const tool = s.segments.find((x) => x.kind === "tool")
    expect(tool && tool.kind === "tool" && !tool.open).toBe(true)

    const [l1, l2] = formatFooter(s.footer)
    expect(l1).toContain("/tmp")
    expect(l2).toContain("Qwopus")
    expect(s.footer.phase).toBe("ready")
  })
})
