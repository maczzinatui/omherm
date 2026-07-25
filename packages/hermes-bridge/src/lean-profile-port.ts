/**
 * LeanProfilePort — S2 settings surface for mesh lean profiles.
 *
 * Prefers gateway JSON-RPC `lean.profile.get` / `lean.profile.set`.
 * Falls back to env-only note when gateway is unavailable.
 */

export type LeanProfileMeta = {
  description: string
  toolsets: string[]
  skills?: boolean
  memory?: boolean
}

export type LeanProfileState = {
  active: string | null
  profiles: Record<string, LeanProfileMeta>
  on_demand?: boolean
  on_demand_scope?: string
}

export type GatewayRequester = {
  request<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>
}

export type LeanProfilePort = {
  get(): Promise<LeanProfileState>
  set(name: string | null, opts?: { persist?: boolean }): Promise<LeanProfileState>
  listNames(): Promise<string[]>
}

/** Process-wide gateway for settings chrome (rebound on brain install). */
let _boundGw: GatewayRequester | null = null

export function bindLeanProfileGateway(gw?: GatewayRequester | null): void {
  _boundGw = gw ?? null
}

export function createLeanProfilePort(gw?: GatewayRequester | null): LeanProfilePort {
  const client = () => gw ?? _boundGw
  async function get(): Promise<LeanProfileState> {
    const g = client()
    if (g) {
      const r = await g.request<LeanProfileState>("lean.profile.get", {})
      return {
        active: r.active ?? null,
        profiles: r.profiles ?? {},
        on_demand: r.on_demand,
        on_demand_scope: r.on_demand_scope,
      }
    }
    // Offline fallback for settings chrome without gateway (names only)
    return {
      active: process.env.HERMES_LEAN_PROFILE?.trim() || null,
      profiles: {
        "l0-arm": {
          description: "delegate_task / job board / local arm",
          toolsets: ["file", "terminal", "web"],
          skills: false,
          memory: false,
        },
        "l1-head": {
          description: "conductor / Herm / omherm",
          toolsets: [
            "file",
            "terminal",
            "web",
            "skills",
            "memory",
            "code_execution",
            "delegation",
            "kanban",
            "todo",
            "session_search",
            "clarify",
          ],
          skills: true,
          memory: true,
        },
        "l1-head-oauth": {
          description: "xai-oauth safe head + x_search",
          toolsets: [
            "file",
            "terminal",
            "skills",
            "memory",
            "code_execution",
            "todo",
            "session_search",
            "clarify",
            "x_search",
          ],
          skills: true,
          memory: true,
        },
        "l1-worker": {
          description: "Orca card / mesh worker",
          toolsets: ["file", "terminal", "web", "skills", "code_execution", "todo", "session_search"],
          skills: true,
          memory: false,
        },
        "msg-optional": {
          description: "head + messaging (operator pin)",
          toolsets: [
            "file",
            "terminal",
            "web",
            "skills",
            "memory",
            "code_execution",
            "delegation",
            "kanban",
            "todo",
            "session_search",
            "clarify",
            "tts",
            "vision",
          ],
          skills: true,
          memory: true,
        },
      },
      on_demand: true,
      on_demand_scope: "library",
    }
  }

  async function set(name: string | null, opts?: { persist?: boolean }): Promise<LeanProfileState> {
    const g = client()
    if (!g) {
      throw new Error("lean.profile.set requires a live gateway (tui_gateway)")
    }
    return g.request<LeanProfileState>("lean.profile.set", {
      name,
      persist: opts?.persist !== false,
    })
  }

  return {
    get,
    set,
    async listNames() {
      const s = await get()
      return Object.keys(s.profiles || {}).sort()
    },
  }
}

export type LibraryPort = {
  tools(opts?: { refresh?: boolean }): Promise<{ count: number; path: string; tools: Array<{ name: string; description?: string }> }>
  skills(opts?: { refresh?: boolean; query?: string }): Promise<{
    count: number
    path: string
    skills: Array<Record<string, unknown>>
  }>
  refresh(): Promise<{ tools_path: string; skills_path: string; ok: boolean }>
  /** Batched S2 open — one RPC for profile + catalogs + optional toolsets. */
  snapshot(opts?: {
    refresh?: boolean
    include_toolsets?: boolean
    include_metrics?: boolean
  }): Promise<Record<string, unknown>>
  /** E9: one-click hub docs_search smoke (no agent turn). */
  docsProbe(opts?: {
    query?: string
    corpus?: string
    top_k?: number
  }): Promise<{
    ok: boolean
    query: string
    corpus: string
    status?: string
    headings?: string[]
    preview?: string
    hub?: string
  }>
}

export function createLibraryPort(gw?: GatewayRequester | null): LibraryPort {
  const client = () => gw ?? _boundGw
  return {
    async tools(opts) {
      const g = client()
      if (!g) return { count: 0, path: "", tools: [] }
      return g.request("library.tools", { refresh: opts?.refresh === true })
    },
    async skills(opts) {
      const g = client()
      if (!g) return { count: 0, path: "", skills: [] }
      return g.request("library.skills", {
        refresh: opts?.refresh === true,
        query: opts?.query || "",
      })
    },
    async refresh() {
      const g = client()
      if (!g) throw new Error("library.refresh requires a live gateway")
      return g.request("library.refresh", {})
    },
    async snapshot(opts) {
      const g = client()
      if (!g) {
        return {
          on_demand: true,
          tools_catalog_count: 0,
          skills_catalog_count: 0,
          always_on_tools: [],
        }
      }
      return g.request("lean.inventory.snapshot", {
        refresh: opts?.refresh === true,
        include_toolsets: opts?.include_toolsets === true,
        include_metrics: opts?.include_metrics === true,
      })
    },
    async docsProbe(opts) {
      const g = client()
      if (!g) throw new Error("docs.probe requires a live gateway")
      return g.request("docs.probe", {
        query: opts?.query || "orch doors ADR-0100",
        corpus: opts?.corpus || "meshina-wiki",
        top_k: opts?.top_k ?? 2,
      })
    },
  }
}

