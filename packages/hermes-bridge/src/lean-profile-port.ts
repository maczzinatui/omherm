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

export function createLeanProfilePort(gw?: GatewayRequester | null): LeanProfilePort {
  async function get(): Promise<LeanProfileState> {
    if (gw) {
      const r = await gw.request<LeanProfileState>("lean.profile.get", {})
      return {
        active: r.active ?? null,
        profiles: r.profiles ?? {},
        on_demand: r.on_demand,
        on_demand_scope: r.on_demand_scope,
      }
    }
    return {
      active: process.env.HERMES_LEAN_PROFILE?.trim() || null,
      profiles: {},
      on_demand: true,
      on_demand_scope: "library",
    }
  }

  async function set(name: string | null, opts?: { persist?: boolean }): Promise<LeanProfileState> {
    if (!gw) {
      throw new Error("lean.profile.set requires a live gateway (tui_gateway)")
    }
    return gw.request<LeanProfileState>("lean.profile.set", {
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
}

export function createLibraryPort(gw?: GatewayRequester | null): LibraryPort {
  if (!gw) {
    return {
      async tools() {
        return { count: 0, path: "", tools: [] }
      },
      async skills() {
        return { count: 0, path: "", skills: [] }
      },
      async refresh() {
        throw new Error("library.refresh requires a live gateway")
      },
    }
  }
  return {
    tools(opts) {
      return gw.request("library.tools", { refresh: opts?.refresh === true })
    },
    skills(opts) {
      return gw.request("library.skills", {
        refresh: opts?.refresh === true,
        query: opts?.query || "",
      })
    },
    refresh() {
      return gw.request("library.refresh", {})
    },
  }
}

