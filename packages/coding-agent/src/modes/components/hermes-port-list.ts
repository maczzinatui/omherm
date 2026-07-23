/**
 * Lightweight port inventory overlay (Kanban / Cron / Profiles).
 * Read-only list via ports — mutations stay on CLI / later editors (Cadillac).
 */
import type { Component, TUI } from "@oh-my-pi/pi-tui"
import { SelectList, type SelectItem } from "@oh-my-pi/pi-tui"
import {
  cronPort,
  kanbanPort,
  profilePort,
  type CronJob,
  type KanbanTask,
  type ProfileInfo,
} from "@meshina/hermes-bridge"
import { getSelectListTheme, theme } from "../theme/theme"
import { bottomBorder, row, topBorder } from "./overlay-box"

export type HermesPortKind = "kanban" | "cron" | "profiles"

export class HermesPortListComponent implements Component {
  #tui: TUI
  #title: string
  #status = "Loading…"
  #list: SelectList
  #onCancel: () => void

  constructor(tui: TUI, kind: HermesPortKind, onCancel: () => void) {
    this.#tui = tui
    this.#onCancel = onCancel
    this.#title =
      kind === "kanban" ? "Hermes Kanban" : kind === "cron" ? "Hermes Cron" : "Hermes Profiles"
    this.#list = new SelectList(
      [{ value: "_loading", label: "Loading…", description: "" }],
      12,
      getSelectListTheme(),
    )
    this.#list.onSelect = () => {
      /* read-only inventory for now */
      this.#onCancel()
    }
    this.#list.onCancel = () => this.#onCancel()
    void this.#load(kind)
  }

  async #load(kind: HermesPortKind): Promise<void> {
    try {
      let items: SelectItem[] = []
      if (kind === "kanban") {
        const tasks = await kanbanPort.list({ limit: 40 })
        items = tasks.map((t: KanbanTask) => ({
          value: t.id,
          label: `${t.status.padEnd(10)} ${t.id}`,
          description: t.title.slice(0, 80),
        }))
        this.#status = tasks.length ? `${tasks.length} tasks · Enter closes · mutations via hermes kanban` : "No tasks"
      } else if (kind === "cron") {
        const jobs = await cronPort.list()
        items = jobs.map((j: CronJob) => ({
          value: j.id,
          label: j.name || j.id,
          description: j.raw.slice(0, 100),
        }))
        this.#status = jobs.length
          ? `${jobs.length} jobs · Enter closes · edit via hermes cron / cron.manage`
          : "No cron jobs (or list empty)"
      } else {
        const profiles = await profilePort.list()
        items = profiles.map((p: ProfileInfo) => ({
          value: p.name,
          label: `${p.is_active ? "●" : "○"} ${p.name}${p.is_sticky ? " (sticky)" : ""}`,
          description: [p.model, p.provider, p.path].filter(Boolean).join(" · ").slice(0, 100),
        }))
        this.#status = `${profiles.length} profiles · switch via hermes profile use (confirm required)`
      }
      if (items.length === 0) {
        items = [{ value: "_empty", label: "(empty)", description: this.#status }]
      }
      this.#list = new SelectList(items, Math.min(items.length, 14), getSelectListTheme())
      this.#list.onSelect = () => this.#onCancel()
      this.#list.onCancel = () => this.#onCancel()
      this.#tui.setFocus(this.#list)
      this.#tui.requestRender()
    } catch (e) {
      this.#status = e instanceof Error ? e.message : String(e)
      this.#list = new SelectList(
        [{ value: "_err", label: "Error", description: this.#status.slice(0, 120) }],
        3,
        getSelectListTheme(),
      )
      this.#list.onSelect = () => this.#onCancel()
      this.#list.onCancel = () => this.#onCancel()
      this.#tui.setFocus(this.#list)
      this.#tui.requestRender()
    }
  }

  handleInput(data: string): void {
    this.#list.handleInput(data)
  }

  render(width: number): string[] {
    const inner = Math.max(20, width - 4)
    const lines = [
      topBorder(width, this.#title),
      row(theme.fg("dim", this.#status), width),
      ...this.#list.render(inner).map((l) => row(l, width)),
      bottomBorder(width),
    ]
    return lines
  }
}
