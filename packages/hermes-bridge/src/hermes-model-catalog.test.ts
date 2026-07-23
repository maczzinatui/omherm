import { describe, expect, test } from "bun:test"
import { flattenCatalog, loadHermesModelCatalog } from "./hermes-model-catalog.ts"
import { buildHermesSlashCatalog, listHermesSkills } from "./hermes-slash-catalog.ts"

describe("hermes model catalog", () => {
  test("flattenCatalog builds selectors", () => {
    const cat = flattenCatalog({
      provider: "xai-oauth",
      model: "grok-4.5",
      providers: [
        {
          slug: "xai-oauth",
          name: "xAI",
          authenticated: true,
          is_current: true,
          models: ["grok-4.5", "grok-3"],
        },
      ],
    })
    expect(cat.rows.length).toBe(2)
    expect(cat.rows[0]?.isCurrentModel).toBe(true)
    expect(cat.rows.some((r) => r.selector === "xai-oauth/grok-3")).toBe(true)
  })

  test("loadHermesModelCatalog live", async () => {
    try {
      const cat = await loadHermesModelCatalog()
      expect(cat.rows.length).toBeGreaterThan(0)
      expect(cat.providers.some((p) => p.authenticated)).toBe(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/ModuleNotFound|hermes|No module/i.test(msg)) return
      throw e
    }
  })
})

describe("hermes slash catalog", () => {
  test("builtins present", () => {
    const c = buildHermesSlashCatalog("/nonexistent-home-for-skills-test")
    expect(c.some((e) => e.name === "model")).toBe(true)
    expect(c.some((e) => e.name === "kanban")).toBe(true)
  })

  test("listHermesSkills from live home", () => {
    const skills = listHermesSkills()
    expect(Array.isArray(skills)).toBe(true)
  })
})
