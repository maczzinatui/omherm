import { describe, expect, test } from "bun:test"
import {
  applyHermesCoatSessionOptions,
  shouldThinOmpAgentHarness,
  summarizeHermesCoatBoot,
} from "../../src/modes/hermes-coat-boot.ts"

describe("hermes coat boot thin", () => {
  test("applyHermesCoatSessionOptions empties tools and disables MCP/extensions", () => {
    const opts = applyHermesCoatSessionOptions({
      toolNames: ["bash", "edit"],
      enableMCP: true,
      enableLsp: true,
    })
    expect(opts.toolNames).toEqual([])
    expect(opts.restrictToolNames).toBe(true)
    expect(opts.enableMCP).toBe(false)
    expect(opts.enableLsp).toBe(false)
    expect(opts.disableExtensionDiscovery).toBe(true)
    expect(opts.skipPythonPreflight).toBe(true)
    expect(opts.skills).toEqual([])
    const s = summarizeHermesCoatBoot(opts)
    expect(s.thinned).toBe(true)
    expect(s.enableMCP).toBe(false)
  })

  test("shouldThinOmpAgentHarness respects OMP brain escape", () => {
    const prevBrand = process.env.MESHINA_TUI_BRAND
    const prevOmp = process.env.MESHINA_TUI_OMP_BRAIN
    const prevHermes = process.env.MESHINA_TUI_HERMES_BRAIN
    try {
      process.env.MESHINA_TUI_BRAND = "hermes"
      delete process.env.MESHINA_TUI_OMP_BRAIN
      delete process.env.MESHINA_TUI_HERMES_BRAIN
      expect(shouldThinOmpAgentHarness()).toBe(true)

      process.env.MESHINA_TUI_OMP_BRAIN = "1"
      expect(shouldThinOmpAgentHarness()).toBe(false)
    } finally {
      if (prevBrand === undefined) delete process.env.MESHINA_TUI_BRAND
      else process.env.MESHINA_TUI_BRAND = prevBrand
      if (prevOmp === undefined) delete process.env.MESHINA_TUI_OMP_BRAIN
      else process.env.MESHINA_TUI_OMP_BRAIN = prevOmp
      if (prevHermes === undefined) delete process.env.MESHINA_TUI_HERMES_BRAIN
      else process.env.MESHINA_TUI_HERMES_BRAIN = prevHermes
    }
  })
})
