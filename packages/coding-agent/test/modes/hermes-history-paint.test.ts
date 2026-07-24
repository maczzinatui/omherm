import { describe, expect, test } from "bun:test"
import {
  flattenHermesText,
  hermesRowsToCoatHistory,
  paintHermesHistoryOnCoat,
  resolveHermesContextWindow,
} from "../../src/modes/hermes-history-paint.ts"

describe("hermes history paint", () => {
  test("flattenHermesText handles string and parts", () => {
    expect(flattenHermesText("hi")).toBe("hi")
    expect(flattenHermesText([{ type: "text", text: "a" }, { type: "text", text: "b" }])).toBe("a\nb")
    expect(flattenHermesText(null)).toBe("")
  })

  test("hermesRowsToCoatHistory maps user/assistant/tool", () => {
    const lines = hermesRowsToCoatHistory([
      { role: "user", text: "hello" },
      { role: "assistant", content: "world" },
      { role: "tool", name: "terminal", context: "ls" },
      { role: "noise" },
    ])
    expect(lines.map((l) => l.role)).toEqual(["user", "assistant", "system"])
    expect(lines[0]?.text).toBe("hello")
    expect(lines[1]?.text).toBe("world")
    expect(lines[2]?.text).toContain("terminal")
  })

  test("paintHermesHistoryOnCoat clears and paints", () => {
    const painted: unknown[] = []
    let cleared = false
    const r = paintHermesHistoryOnCoat(
      {
        clearTransientSessionUi: () => {
          cleared = true
        },
        chatContainer: {
          clear: () => {
            cleared = true
          },
        },
        addMessageToChat: (m) => {
          painted.push(m)
          return []
        },
      },
      [
        { role: "user", text: "u1" },
        { role: "assistant", text: "a1" },
      ],
      { notice: "Resumed test" },
    )
    expect(cleared).toBe(true)
    expect(r.painted).toBe(2)
    expect(painted.length).toBeGreaterThanOrEqual(3) // notice + 2
  })

  test("resolveHermesContextWindow prefers usage.context_max", () => {
    expect(resolveHermesContextWindow({ usage: { context_max: 65536 } })).toBe(65536)
    expect(resolveHermesContextWindow({}, 200_000)).toBe(200_000)
    expect(resolveHermesContextWindow({})).toBe(128_000)
  })
})
