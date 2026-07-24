import { describe, expect, test } from "bun:test"
import { ThinkingLevel } from "@oh-my-pi/pi-agent-core"
import {
  hermesFooterModelName,
  hermesIdentityToModel,
  mapHermesEffortToThinking,
  mapThinkingToHermesEffort,
} from "../../src/modes/hermes-coat-identity.ts"

describe("hermes coat identity", () => {
  test("footer name uses last path segment", () => {
    expect(hermesFooterModelName("poolside/laguna-s-2.1:free")).toBe("laguna-s-2.1:free")
    expect(hermesFooterModelName("laguna-xs-2.1:free")).toBe("laguna-xs-2.1:free")
  })

  test("synthetic model is reasoning-capable for effort chrome", () => {
    const m = hermesIdentityToModel("nous", "poolside/laguna-s-2.1:free")
    expect(m.provider).toBe("nous")
    expect(m.id).toBe("poolside/laguna-s-2.1:free")
    expect(m.name).toBe("laguna-s-2.1:free")
    expect(m.reasoning).toBe(true)
    expect(m.thinking).toBeTruthy()
    expect(m.contextWindow).toBe(128_000)
  })

  test("contextWindow opts override synthetic default", () => {
    const m = hermesIdentityToModel("xai", "grok-4.5", { contextWindow: 256_000 })
    expect(m.contextWindow).toBe(256_000)
  })

  test("effort map round-trips high", () => {
    expect(mapHermesEffortToThinking("high")).toBe(ThinkingLevel.High)
    expect(mapThinkingToHermesEffort(ThinkingLevel.High)).toBe("high")
    expect(mapHermesEffortToThinking("off")).toBe(ThinkingLevel.Off)
  })
})
