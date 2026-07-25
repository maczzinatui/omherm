import { describe, expect, test } from "bun:test"
import { createLeanProfilePort, createLibraryPort } from "./lean-profile-port.ts"

describe("lean-profile-port", () => {
  test("get/set via gateway RPC", async () => {
    const calls: Array<{ method: string; params: Record<string, unknown> }> = []
    const gw = {
      request: async <T>(method: string, params: Record<string, unknown> = {}) => {
        calls.push({ method, params })
        if (method === "lean.profile.get") {
          return {
            active: "l1-head-oauth",
            profiles: {
              "l1-head": { description: "head", toolsets: ["file"] },
              "l1-head-oauth": { description: "oauth", toolsets: ["file", "x_search"] },
            },
            on_demand: true,
            on_demand_scope: "library",
          } as T
        }
        if (method === "lean.profile.set") {
          return {
            active: params.name as string,
            profiles: { "l0-arm": { description: "arm", toolsets: ["file"] } },
          } as T
        }
        throw new Error(`unexpected ${method}`)
      },
    }
    const port = createLeanProfilePort(gw)
    const state = await port.get()
    expect(state.active).toBe("l1-head-oauth")
    expect(state.on_demand).toBe(true)
    expect(Object.keys(state.profiles)).toContain("l1-head-oauth")
    const names = await port.listNames()
    expect(names).toContain("l1-head")
    const after = await port.set("l0-arm")
    expect(after.active).toBe("l0-arm")
    expect(calls.map((c) => c.method)).toEqual([
      "lean.profile.get",
      "lean.profile.get",
      "lean.profile.set",
    ])
  })

  test("library port hits library.* RPC", async () => {
    const methods: string[] = []
    const gw = {
      request: async <T>(method: string) => {
        methods.push(method)
        if (method === "library.tools") return { count: 1, path: "/t", tools: [{ name: "x" }] } as T
        if (method === "library.skills") return { count: 1, path: "/s", skills: [{ name: "y" }] } as T
        if (method === "library.refresh") return { tools_path: "/t", skills_path: "/s", ok: true } as T
        throw new Error(method)
      },
    }
    const lib = createLibraryPort(gw)
    expect((await lib.tools()).count).toBe(1)
    expect((await lib.skills()).skills[0]?.name).toBe("y")
    expect((await lib.refresh()).ok).toBe(true)
    expect(methods).toEqual(["library.tools", "library.skills", "library.refresh"])
  })

  test("library.snapshot hits lean.inventory.snapshot", async () => {
    const methods: string[] = []
    const gw = {
      request: async <T>(method: string, params: Record<string, unknown> = {}) => {
        methods.push(method)
        if (method === "lean.inventory.snapshot") {
          return {
            on_demand: true,
            tools_catalog_count: 41,
            skills_catalog_count: 80,
            always_on_tools: ["read_file", "terminal"],
            ...params,
          } as T
        }
        throw new Error(method)
      },
    }
    const lib = createLibraryPort(gw)
    const snap = await lib.snapshot({ include_toolsets: true })
    expect(snap.tools_catalog_count).toBe(41)
    expect(methods).toEqual(["lean.inventory.snapshot"])
  })
})
