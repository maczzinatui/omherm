import { describe, expect, test } from "bun:test"
import { routeConfigKey, writeConfigLane, RPC_ALIAS } from "./config-lane.ts"

describe("config-lane (Herm parity)", () => {
  test("RPC_ALIAS covers reasoning + model", () => {
    expect(RPC_ALIAS["agent.reasoning_effort"]?.alias).toBe("reasoning")
    expect(RPC_ALIAS.model?.alias).toBe("model")
    expect(routeConfigKey("agent.reasoning_effort").via).toBe("rpc")
    expect(routeConfigKey("approvals.mode").via).toBe("cli")
  })

  test("writeConfigLane uses config.set for hot keys", async () => {
    const calls: Array<{ method: string; params: Record<string, unknown> }> = []
    const gw = {
      request: async <T>(method: string, params: Record<string, unknown> = {}) => {
        calls.push({ method, params })
        return {} as T
      },
    }
    const r = await writeConfigLane(gw, [{ key: "agent.reasoning_effort", to: "high" }])
    expect(r.ok).toEqual(["agent.reasoning_effort"])
    expect(r.modes["agent.reasoning_effort"]).toBe("rpc")
    expect(calls[0]?.method).toBe("config.set")
    expect(calls[0]?.params.key).toBe("reasoning")
    expect(calls[0]?.params.value).toBe("high")
  })

  test("writeConfigLane show_reasoning wires show/hide", async () => {
    const calls: Array<Record<string, unknown>> = []
    const gw = {
      request: async <T>(_m: string, params: Record<string, unknown> = {}) => {
        calls.push(params)
        return {} as T
      },
    }
    await writeConfigLane(gw, [{ key: "display.show_reasoning", to: true }])
    expect(calls[0]?.value).toBe("show")
    await writeConfigLane(gw, [{ key: "display.show_reasoning", to: false }])
    expect(calls[1]?.value).toBe("hide")
  })

  test("writeConfigLane CLI path when no gateway", async () => {
    const argvLog: string[][] = []
    const r = await writeConfigLane(null, [{ key: "approvals.mode", to: "manual" }], {
      runCli: async (argv) => {
        argvLog.push(argv)
        return { code: 0, stdout: "ok", stderr: "" }
      },
    })
    expect(r.ok).toEqual(["approvals.mode"])
    expect(r.modes["approvals.mode"]).toBe("cli")
    expect(argvLog[0]).toEqual(["config", "set", "approvals.mode", "manual"])
  })
})
