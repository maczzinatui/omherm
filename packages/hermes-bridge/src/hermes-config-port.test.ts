import { describe, expect, test } from "bun:test"
import {
  createHermesConfigPort,
  HERMES_CONFIG_FIELDS,
  HERMES_CONFIG_KEYS,
} from "./hermes-config-port.ts"

describe("HermesConfigPort", () => {
  test("P1 field allowlist covers model approvals compression", () => {
    expect(HERMES_CONFIG_KEYS).toContain("agent.reasoning_effort")
    expect(HERMES_CONFIG_KEYS).toContain("approvals.mode")
    expect(HERMES_CONFIG_KEYS).toContain("compression.enabled")
    expect(HERMES_CONFIG_KEYS).toContain("terminal.backend")
    expect(HERMES_CONFIG_KEYS).toContain("kanban.dispatch_in_gateway")
    expect(HERMES_CONFIG_KEYS).toContain("memory.memory_enabled")
    expect(HERMES_CONFIG_KEYS).not.toContain("model.default") // pick via OMP hub
    expect(HERMES_CONFIG_FIELDS.every((f) => f.key && f.tab && f.group)).toBe(true)
    const tabs = new Set(HERMES_CONFIG_FIELDS.map((f) => f.tab))
    expect(tabs.has("appearance")).toBe(true)
    expect(tabs.has("shell")).toBe(true)
    expect(tabs.has("tasks")).toBe(true)
    expect(tabs.has("providers")).toBe(true)
  })

  test("build argv", () => {
    const p = createHermesConfigPort(async () => ({ code: 0, stdout: "true", stderr: "" }))
    expect(p.buildGetArgv("approvals.mode")).toEqual(["config", "get", "approvals.mode", "--json"])
    expect(p.buildSetArgv("compression.enabled", false)).toEqual([
      "config",
      "set",
      "compression.enabled",
      "false",
    ])
  })

  test("set rejects unknown key", async () => {
    const p = createHermesConfigPort(async () => ({ code: 0, stdout: "", stderr: "" }))
    await expect(p.set("not.a.key", 1)).rejects.toThrow(/allowlist/)
  })

  test("get/set via mock", async () => {
    const store = new Map<string, string>([
      ["approvals.mode", '"smart"'],
      ["compression.enabled", "true"],
    ])
    const p = createHermesConfigPort(async (argv) => {
      if (argv[0] === "config" && argv[1] === "get") {
        const key = argv[2]
        if (!store.has(key)) return { code: 1, stdout: "", stderr: `Config key not set: ${key}` }
        return { code: 0, stdout: store.get(key)!, stderr: "" }
      }
      if (argv[0] === "config" && argv[1] === "set") {
        const key = argv[2]
        const val = argv[3]
        // store json-ish
        if (val === "true" || val === "false") store.set(key, val)
        else if (/^-?\d/.test(val)) store.set(key, val)
        else store.set(key, JSON.stringify(val))
        return { code: 0, stdout: "ok", stderr: "" }
      }
      return { code: 1, stdout: "", stderr: "bad" }
    })
    await p.refresh(["approvals.mode", "compression.enabled"])
    expect(p.getCached("approvals.mode")).toBe("smart")
    expect(p.getCached("compression.enabled")).toBe(true)
    await p.set("approvals.mode", "manual")
    expect(p.getCached("approvals.mode")).toBe("manual")
  })

  test("live hermes config get model.default", async () => {
    const p = createHermesConfigPort()
    try {
      const v = await p.get("model.default")
      expect(v === undefined || typeof v === "string").toBe(true)
    } catch (e) {
      // hermes missing in CI — skip
      const msg = e instanceof Error ? e.message : String(e)
      if (/not found|No such file|hermes/i.test(msg)) return
      throw e
    }
  })
})
