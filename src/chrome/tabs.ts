// Top chrome — Herm-class toolbar (gateway-backed panels).
// Product decision 2026-07-23: bring Sessions / Config / Models / Kanban / …
// usability into meshina-tui. Paint with pi-tui; data from tui_gateway RPCs.
// Do not port Herm React components wholesale — reimplement against the wire.

export type TabId =
  | "chat"
  | "sessions"
  | "kanban"
  | "skills"
  | "agents"
  | "cron"
  | "config"
  | "models"
  | "toolsets"
  | "memory"
  | "context"

export type TabDef = {
  id: TabId
  label: string
  short: string
  /** Gateway RPCs this panel needs (doc + loaders). */
  rpcs: string[]
  /** Spike priority: 0 = ship in first usable dogfood. */
  tier: 0 | 1 | 2
}

/**
 * Top-level toolbar. Mirrors Herm's operator surface (chat + groups),
 * flattened for pi-tui TabBar until we need nested sub-tabs.
 */
export const TOOLBAR: readonly TabDef[] = [
  {
    id: "chat",
    label: "Chat",
    short: "Chat",
    rpcs: ["prompt.submit", "session.interrupt", "session.steer", "session.create", "session.resume"],
    tier: 0,
  },
  {
    id: "sessions",
    label: "Sessions",
    short: "Sess",
    rpcs: ["session.list", "session.active_list", "session.resume", "session.delete", "session.title"],
    tier: 0,
  },
  {
    id: "kanban",
    label: "Kanban",
    short: "Board",
    rpcs: ["shell.exec"], // hermes kanban CLI via shell until first-class RPC
    tier: 0,
  },
  {
    id: "models",
    label: "Models",
    short: "Model",
    rpcs: ["config.get", "config.set"],
    tier: 0,
  },
  {
    id: "config",
    label: "Config",
    short: "Cfg",
    rpcs: ["config.get", "config.set"],
    tier: 1,
  },
  {
    id: "skills",
    label: "Skills",
    short: "Sk",
    rpcs: ["skills.manage"],
    tier: 1,
  },
  {
    id: "toolsets",
    label: "Toolsets",
    short: "Tools",
    rpcs: ["toolsets.list", "tools.configure"],
    tier: 1,
  },
  {
    id: "agents",
    label: "Agents",
    short: "Ag",
    rpcs: ["delegation.status", "subagent.interrupt", "spawn_tree.list"],
    tier: 1,
  },
  {
    id: "cron",
    label: "Cron",
    short: "Cron",
    rpcs: ["cron.manage"],
    tier: 1,
  },
  {
    id: "memory",
    label: "Memory",
    short: "Mem",
    rpcs: ["shell.exec"], // profile memory paths; tighten when gateway grows RPCs
    tier: 2,
  },
  {
    id: "context",
    label: "Context",
    short: "Ctx",
    rpcs: ["session.context_breakdown"],
    tier: 2,
  },
] as const

export const TIER0 = TOOLBAR.filter((t) => t.tier === 0)
