import { describe, expect, test } from "bun:test"
import {
  hermesCatalogToScopedModels,
  hermesProviderLabels,
  hermesRowToModel,
} from "../../../src/modes/components/hermes-model-picker"
import type { HermesModelCatalog } from "@omherm/hermes-bridge"

const sample: HermesModelCatalog = {
  provider: "nous",
  model: "hermes-3",
  providers: [
    { slug: "nous", name: "Nous Portal", authenticated: true, is_current: true, models: ["hermes-3", "hermes-4"] },
    { slug: "xai-oauth", name: "xAI (OAuth)", authenticated: true, is_current: false, models: ["grok-4"] },
  ],
  rows: [
    {
      provider: "nous",
      providerName: "Nous Portal",
      id: "hermes-3",
      selector: "nous/hermes-3",
      isCurrentProvider: true,
      isCurrentModel: true,
    },
    {
      provider: "xai-oauth",
      providerName: "xAI (OAuth)",
      id: "grok-4",
      selector: "xai-oauth/grok-4",
      isCurrentProvider: false,
      isCurrentModel: false,
    },
  ],
}

describe("hermes catalog → OMP hub feed", () => {
  test("scoped models use Hermes provider slugs", () => {
    const scoped = hermesCatalogToScopedModels(sample)
    expect(scoped).toHaveLength(2)
    expect(scoped[0]!.model.provider).toBe("nous")
    expect(scoped[0]!.model.id).toBe("hermes-3")
    expect(scoped[1]!.model.provider).toBe("xai-oauth")
  })

  test("provider labels map nous → Nous Portal", () => {
    const labels = hermesProviderLabels(sample)
    expect(labels.nous).toBe("Nous Portal")
    expect(labels["xai-oauth"]).toBe("xAI (OAuth)")
  })

  test("row to model is selectable chrome shape", () => {
    const m = hermesRowToModel(sample.rows[0]!)
    expect(m.provider).toBe("nous")
    expect(m.id).toBe("hermes-3")
  })
})
