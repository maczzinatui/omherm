/**
 * Hermes model picker — same chrome contract as OMP ModelPickerComponent
 * (row(content, width)). Product /model uses OMP ModelHub fed from
 * {@link hermesCatalogToScopedModels} so the window looks stock OMP.
 */
import type { Model } from "@oh-my-pi/pi-ai"
import { buildModel } from "@oh-my-pi/pi-catalog/build"
import type { Component, TUI } from "@oh-my-pi/pi-tui"
import {
  loadHermesModelCatalog,
  type HermesModelCatalog,
  type HermesModelRow,
} from "@omherm/hermes-bridge"
import type { Settings } from "../../config/settings"
import { theme } from "../theme/theme"
import { ModelBrowser, type ModelBrowserItem } from "./model-browser"
import type { ScopedModelItem } from "./model-hub"
import { bottomBorder, row, topBorder } from "./overlay-box"
import { enableOverlayScopedPaint, paintOverlayLocal } from "../utils/overlay-paint"

export type HermesModelPickerCallbacks = {
  onPick: (row: HermesModelRow) => void | Promise<void>
  onCancel: () => void
  onError?: (message: string) => void
}

const CHROME_ROWS = 4
const BROWSER_FRAME_ROWS = 5
const MIN_VISIBLE = 5
const HEIGHT_FRACTION = 0.45

/** Synthetic OMP Model for hub/picker chrome (Hermes is SoT for auth/routing). */
export function hermesRowToModel(row: HermesModelRow): Model {
  // Must declare thinking.efforts or OMP clamps every effort to undefined
  // (same bug as hermesIdentityToModel — empty efforts ⇒ blank footer/menu).
  return buildModel({
    id: row.id,
    name: row.id.includes("/") ? row.id.split("/").pop() || row.id : row.id,
    provider: row.provider,
    api: "openai-completions",
    baseUrl: "",
    reasoning: true,
    thinking: {
      efforts: ["minimal", "low", "medium", "high", "xhigh", "max"],
      defaultLevel: "low",
    },
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8192,
  })
}

/** Feed OMP ModelHub / ModelPicker via scopedModels so chrome stays stock. */
export function hermesCatalogToScopedModels(cat: HermesModelCatalog): ScopedModelItem[] {
  return cat.rows.map(r => ({ model: hermesRowToModel(r) }))
}

/** Sidebar labels: slug → Hermes display name (e.g. nous → Nous Portal). */
export function hermesProviderLabels(cat: HermesModelCatalog): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of cat.providers) {
    if (p.slug) out[p.slug] = p.name || p.slug
  }
  return out
}

function asLine(value: unknown): string {
  if (typeof value === "string") return value
  if (value == null) return ""
  return String(value)
}

export class HermesModelPickerComponent implements Component {
  #tui: TUI
  #browser: ModelBrowser
  #status = "Loading Hermes models…"
  #error: string | undefined
  #rows: HermesModelRow[] = []

  constructor(
    tui: TUI,
    settings: Settings,
    callbacks: HermesModelPickerCallbacks,
    options: { currentSelector?: string } = {},
  ) {
    this.#tui = tui
    enableOverlayScopedPaint(this.#tui, this)
    this.#browser = new ModelBrowser(settings, {
      disableOverContext: false,
      emptyText: () => (this.#error ? `  ${this.#error}` : "  No Hermes models"),
    })
    this.#browser.onActivate = item => {
      const row = this.#rows.find(r => r.selector === item.selector)
      if (!row) return
      void Promise.resolve(callbacks.onPick(row)).catch(e => {
        callbacks.onError?.(e instanceof Error ? e.message : String(e))
      })
    }
    this.#browser.onCancel = () => callbacks.onCancel()

    void loadHermesModelCatalog()
      .then(cat => {
        this.#rows = cat.rows
        this.#status =
          cat.provider && cat.model
            ? `Hermes · current ${cat.provider}/${cat.model} · Enter sets global default`
            : "Hermes model catalog · Enter sets global default (config)"
        const items: ModelBrowserItem[] = cat.rows.map(r => ({
          provider: r.provider,
          id: r.id,
          selector: r.selector,
          model: hermesRowToModel(r),
          labelColor: r.isCurrentModel ? "accent" : undefined,
        }))
        this.#browser.setItems(items)
        const cur =
          options.currentSelector ||
          cat.rows.find(r => r.isCurrentModel)?.selector ||
          (cat.provider && cat.model ? `${cat.provider}/${cat.model}` : undefined)
        if (cur) this.#browser.selectSelector(cur)
        paintOverlayLocal(this.#tui, this)
      })
      .catch(e => {
        this.#error = e instanceof Error ? e.message : String(e)
        this.#status = "Failed to load Hermes model catalog"
        paintOverlayLocal(this.#tui, this)
      })
  }

  invalidate(): void {}

  handleInput(data: string): void {
    if (data.startsWith("\x1b[<")) return
    this.#browser.handleInput(data)
  }

  render(width: number): string[] {
    const termRows = Math.max(16, this.#tui.terminal?.rows || process.stdout.rows || 40)
    const listBudget = Math.floor(termRows * HEIGHT_FRACTION) - CHROME_ROWS - BROWSER_FRAME_ROWS
    this.#browser.setMaxVisible(Math.max(MIN_VISIBLE, listBudget))

    const inner = Math.max(1, width - 4)
    const status = this.#error
      ? theme.fg("error", ` ${this.#error}`)
      : theme.fg("muted", ` ${this.#status}`)

    const out: string[] = []
    out.push(topBorder(width, "Switch Model"))
    out.push(row(status, width))
    for (const line of this.#browser.render(inner)) {
      out.push(row(asLine(line), width))
    }
    out.push(
      row(
        theme.fg("dim", "↑/↓ · Enter = Hermes global default · type search · Esc · no OMP roles"),
        width,
      ),
    )
    out.push(bottomBorder(width))
    return out
  }
}

export async function defaultHermesModelPick(row: HermesModelRow): Promise<string> {
  const { applyHermesModelLive } = await import("@omherm/hermes-bridge")
  await applyHermesModelLive(row.provider, row.id)
  return `${row.provider}/${row.id}`
}
