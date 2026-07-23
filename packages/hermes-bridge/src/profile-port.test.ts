import { describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { buildProfileArgv, createProfileCli, formatProfileCommand } from "./profile-cli.ts"
import {
  hermesRootFromHome,
  profileNameFromHome,
  shellQuote,
  validateProfileName,
} from "./profile-dto.ts"
import { defaultHermesHome, listProfiles, stickyDefault } from "./profile-fs.ts"
import { createProfilePort } from "./profile-port.ts"

describe("profile dto", () => {
  test("profileNameFromHome default vs named", () => {
    expect(profileNameFromHome("/home/x/.hermes")).toBe("default")
    expect(profileNameFromHome("/home/x/.hermes/")).toBe("default")
    expect(profileNameFromHome("/home/x/.hermes/profiles/developer")).toBe("developer")
    expect(profileNameFromHome("/home/x/.hermes/profiles/developer/")).toBe("developer")
  })

  test("hermesRootFromHome climbs out of profiles", () => {
    expect(hermesRootFromHome("/home/x/.hermes")).toBe("/home/x/.hermes")
    expect(hermesRootFromHome("/home/x/.hermes/profiles/dev")).toBe("/home/x/.hermes")
  })

  test("validateProfileName", () => {
    expect(validateProfileName("ok-name")).toBeNull()
    expect(validateProfileName("default")).toMatch(/default/)
    expect(validateProfileName("Bad")).toMatch(/match/)
    expect(validateProfileName("x", ["x"])).toMatch(/already/)
  })

  test("shellQuote safe", () => {
    expect(shellQuote("simple")).toBe("simple")
    expect(shellQuote("a b")).toBe("'a b'")
    expect(formatProfileCommand("use", ["developer"])).toBe("hermes profile use developer")
  })
})

describe("profile cli argv", () => {
  test("buildProfileArgv", () => {
    expect(buildProfileArgv("delete", ["foo", "-y"])).toEqual(["profile", "delete", "foo", "-y"])
  })

  test("createProfileCli fails on nonzero", async () => {
    const cli = createProfileCli(async (argv) => ({
      code: 2,
      stdout: "",
      stderr: `fail ${argv.join(" ")}`,
      argv: ["hermes", ...argv],
    }))
    await expect(cli.use("x")).rejects.toThrow(/fail/)
  })
})

describe("profile port confirms", () => {
  test("use/delete require confirm flags", async () => {
    const port = createProfilePort({
      cli: createProfileCli(async () => ({
        code: 0,
        stdout: "ok",
        stderr: "",
        argv: [],
      })),
    })
    await expect(port.use("developer", { confirmSessionEnd: true })).resolves.toBeUndefined()
    await expect(
      port.use("developer", { confirmSessionEnd: false as unknown as true }),
    ).rejects.toThrow(/confirmSessionEnd/)
    await expect(port.delete("developer", { confirmDestroy: true })).resolves.toBeUndefined()
    await expect(port.delete("default", { confirmDestroy: true })).rejects.toThrow(/default/)
  })
})

describe("profile fs live", () => {
  test("listProfiles includes default when ~/.hermes exists", () => {
    const home = defaultHermesHome()
    if (!existsSync(home)) return
    const list = listProfiles(home)
    expect(list.some((p) => p.name === "default")).toBe(true)
    expect(list.every((p) => typeof p.gateway_running === "boolean")).toBe(true)
    expect(list.every((p) => typeof p.has_env === "boolean")).toBe(true)
  })

  test("stickyDefault reads active_profile when present", () => {
    const root = hermesRootFromHome(defaultHermesHome())
    const s = stickyDefault(root)
    expect(s === null || typeof s === "string").toBe(true)
  })
})
