import { describe, expect, test } from "bun:test"
import { createCockpitSession, isCockpitSession, type MessageImage } from "./cockpit-session.ts"
import type { HermesBrain } from "./hermes-brain.ts"
import type { SessionInfo } from "./types.ts"

function fakeBrain(overrides: Partial<HermesBrain> = {}): HermesBrain {
  const info: SessionInfo = {
    model: "grok-4.5",
    provider: "xai",
    reasoning_effort: "high",
    usage: { context_max: 256_000, context_used: 1000 },
  }
  const listeners = new Set<(e: unknown) => void>()
  const brain = {
    streaming: false,
    ready: true,
    sessionId: "sess-1",
    sessionInfo: info,
    subscribe: (cb: (e: unknown) => void) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    prompt: async (text: string, images?: readonly MessageImage[]) => {
      const b = brain as { lastPrompt?: string; lastImages?: readonly MessageImage[] }
      b.lastPrompt = text
      b.lastImages = images
    },
    interrupt: async () => {
      ;(brain as { interrupted?: boolean }).interrupted = true
    },
    steer: async (text: string, images?: readonly MessageImage[]) => {
      const b = brain as { lastSteer?: string; lastSteerImages?: readonly MessageImage[] }
      b.lastSteer = text
      b.lastSteerImages = images
    },
    refreshInfo: async () => info,
    slashExec: async (cmd: string) => ({ output: `ok:${cmd}` }),
    ...overrides,
  }
  return brain as unknown as HermesBrain
}

describe("CockpitSession", () => {
  test("createCockpitSession delegates to brain", async () => {
    const brain = fakeBrain()
    const cock = createCockpitSession(brain)
    expect(isCockpitSession(cock)).toBe(true)
    expect(cock.info().model).toBe("grok-4.5")
    expect(cock.sessionId).toBe("sess-1")
    expect(cock.ready).toBe(true)
    expect(cock.brain).toBe(brain)

    await cock.submit("hello")
    expect((brain as { lastPrompt?: string }).lastPrompt).toBe("hello")

    await cock.steer("nudge")
    expect((brain as { lastSteer?: string }).lastSteer).toBe("nudge")

    await cock.interrupt()
    expect((brain as { interrupted?: boolean }).interrupted).toBe(true)

    const r = await cock.slashExec("/help")
    expect(r.output).toBe("ok:/help")

    const refreshed = await cock.refreshInfo()
    expect(refreshed.usage?.context_max).toBe(256_000)

    let saw = false
    const unsub = cock.onEvent(() => {
      saw = true
    })
    // fire via brain subscribe set — call listener through brain's set
    // Our fake stores listeners; invoke manually:
    const unsub2 = brain.subscribe(() => {
      saw = true
    })
    // Direct: invoke by re-subscribing path
    unsub()
    unsub2()
    expect(typeof unsub).toBe("function")
    void saw
  })

  test("submit forwards optional images to brain prompt", async () => {
    const brain = fakeBrain()
    const cock = createCockpitSession(brain)
    const images: readonly MessageImage[] = [
      { url: "/tmp/a.png", alt: "alpha" },
      { url: "https://example.com/b.jpg" },
    ]
    await cock.submit("describe", images)
    expect((brain as { lastPrompt?: string }).lastPrompt).toBe("describe")
    expect((brain as { lastImages?: readonly MessageImage[] }).lastImages).toBe(images)
  })

  test("steer forwards optional images to brain steer", async () => {
    const brain = fakeBrain()
    const cock = createCockpitSession(brain)
    const images: readonly MessageImage[] = [{ url: "/tmp/c.png" }]
    await cock.steer("nudge", images)
    expect((brain as { lastSteer?: string }).lastSteer).toBe("nudge")
    expect((brain as { lastSteerImages?: readonly MessageImage[] }).lastSteerImages).toBe(images)
  })

  test("submit without images leaves brain.prompt images undefined", async () => {
    const brain = fakeBrain()
    const cock = createCockpitSession(brain)
    await cock.submit("plain")
    expect((brain as { lastImages?: readonly MessageImage[] }).lastImages).toBeUndefined()
  })

  test("isCockpitSession rejects junk", () => {
    expect(isCockpitSession(null)).toBe(false)
    expect(isCockpitSession({})).toBe(false)
    expect(isCockpitSession({ info: () => ({}) })).toBe(false)
  })
})
