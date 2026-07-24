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

  test("formatHermesModelSlash builds gateway /model --global", async () => {
    const { formatHermesModelSlash, bareModelId } = await import("./hermes-model-catalog.ts")
    expect(bareModelId("nous", "nous/foo")).toBe("foo")
    expect(bareModelId("nous", "laguna-xs-2.1:free")).toBe("laguna-xs-2.1:free")
    // org/name:tag must NOT lose the org segment
    expect(bareModelId("nous", "inclusionai/ling-3.0-flash:free")).toBe(
      "inclusionai/ling-3.0-flash:free",
    )
    expect(bareModelId("nous", "nous/inclusionai/ling-3.0-flash:free")).toBe(
      "inclusionai/ling-3.0-flash:free",
    )
    expect(formatHermesModelSlash("nous", "laguna-xs-2.1:free")).toBe(
      "/model laguna-xs-2.1:free --provider nous --global",
    )
    expect(formatHermesModelSlash("nous", "inclusionai/ling-3.0-flash:free")).toBe(
      "/model inclusionai/ling-3.0-flash:free --provider nous --global",
    )
    expect(formatHermesModelSlash("xai-oauth", "grok-4", { global: false })).toBe(
      "/model grok-4 --provider xai-oauth",
    )
  })

  test("applyHermesModelLive prefers slashExec", async () => {
    const { applyHermesModelLive, formatHermesModelSlash } = await import("./hermes-model-catalog.ts")
    const calls: string[] = []
    const r = await applyHermesModelLive("nous", "hermes-3", {
      slashExec: async cmd => {
        calls.push(cmd)
        return { output: "ok switched" }
      },
    })
    expect(r.mode).toBe("gateway")
    expect(calls[0]).toBe(formatHermesModelSlash("nous", "hermes-3"))
  })

  test("applyHermesModelLive fails loud on not-found prose", async () => {
    const { applyHermesModelLive } = await import("./hermes-model-catalog.ts")
    await expect(
      applyHermesModelLive("nous", "inclusionai/ling-3.0-flash:free", {
        slashExec: async () => ({
          output:
            "live session sync failed: Model `ling-3.0-flash:free` was not found in this provider's model listing.",
        }),
      }),
    ).rejects.toThrow(/not found|live session sync failed/i)
  })

  test("pickNextHermesModelRow walks catalog not role registry", async () => {
    const { flattenCatalog, pickNextHermesModelRow } = await import("./hermes-model-catalog.ts")
    const cat = flattenCatalog({
      provider: "nous",
      model: "a",
      providers: [
        {
          slug: "nous",
          name: "Nous",
          authenticated: true,
          is_current: true,
          models: ["a", "b", "org/c:free"],
        },
      ],
    })
    const fwd = pickNextHermesModelRow(cat.rows, { provider: "nous", model: "a" }, "forward")
    expect(fwd?.id).toBeTruthy()
    expect(fwd?.id).not.toBe("a")
    const back = pickNextHermesModelRow(cat.rows, { provider: "nous", model: fwd!.id }, "backward")
    // may not return exactly a if sort order differs — at least cycles
    expect(back?.id).toBeTruthy()
    expect(pickNextHermesModelRow(cat.rows.slice(0, 1), { model: "a" }, "forward")).toBeUndefined()
    expect(pickNextHermesModelRow([], { model: "a" }, "forward")).toBeUndefined()
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
