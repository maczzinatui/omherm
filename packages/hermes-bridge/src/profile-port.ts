// ProfilePort façade — settings UI depends on this only.

import { createProfileCli, type ProfileCli } from "./profile-cli.ts"
import {
  validateProfileName,
  type ProfileInfo,
} from "./profile-dto.ts"
import {
  defaultHermesHome,
  listProfiles,
  resolveProfileDir,
  stickyDefault,
  hermesRootFromHome,
  profileNameFromHome,
} from "./profile-fs.ts"

export type ProfilePortOptions = {
  /** Gateway-reported HERMES_HOME for is_active. */
  getActiveHome?: () => Promise<string | null> | string | null
  cli?: ProfileCli
}

export type UseProfileOptions = {
  /** Required true — switching restarts gateway / ends session. */
  confirmSessionEnd: true
}

export type DeleteProfileOptions = {
  confirmDestroy: true
}

export function createProfilePort(opts: ProfilePortOptions = {}) {
  const cli = opts.cli ?? createProfileCli()

  async function activeHome(): Promise<string | null> {
    if (!opts.getActiveHome) return defaultHermesHome()
    return await opts.getActiveHome()
  }

  return {
    /** Inventory for Settings → Profiles. */
    async list(): Promise<ProfileInfo[]> {
      const home = await activeHome()
      return listProfiles(home)
    },

    async get(name: string): Promise<ProfileInfo | null> {
      const all = await this.list()
      return all.find((p) => p.name === name) ?? null
    },

    async activeName(): Promise<string> {
      const home = (await activeHome()) || defaultHermesHome()
      return profileNameFromHome(home)
    },

    stickyName(): string | null {
      return stickyDefault(hermesRootFromHome(defaultHermesHome()))
    },

    resolveDir(name: string): string | null {
      return resolveProfileDir(name)
    },

    validateName(name: string, existing?: string[]): string | null {
      return validateProfileName(name, existing)
    },

    /**
     * Sticky default + gateway reattach path. Caller must pass confirmSessionEnd.
     * UI must warn: current session ends; history stays on previous profile.
     */
    async use(name: string, confirm: UseProfileOptions): Promise<void> {
      if (confirm.confirmSessionEnd !== true) {
        throw new Error("profile.use requires confirmSessionEnd: true")
      }
      const dir = resolveProfileDir(name)
      if (!dir && name !== "default") throw new Error(`profile not found: ${name}`)
      await cli.use(name)
    },

    async create(name: string, extraArgs: string[] = []): Promise<void> {
      const existing = (await this.list()).map((p) => p.name)
      const err = validateProfileName(name, existing)
      if (err) throw new Error(err)
      await cli.create(name, extraArgs)
    },

    async delete(name: string, confirm: DeleteProfileOptions): Promise<void> {
      if (confirm.confirmDestroy !== true) {
        throw new Error("profile.delete requires confirmDestroy: true")
      }
      if (name === "default") throw new Error("cannot delete default profile")
      await cli.delete(name)
    },

    async describe(name: string, text?: string): Promise<string> {
      const r = await cli.describe(name, text)
      return (r.stdout || "").trim()
    },

    async updateDistribution(name: string, opts?: { forceConfig?: boolean }): Promise<void> {
      await cli.update(name, opts)
    },

    async showCli(name: string): Promise<string> {
      const r = await cli.show(name)
      return (r.stdout || "").trim()
    },
  }
}

export type ProfilePort = ReturnType<typeof createProfilePort>

/** Default port (process HERMES_HOME; wire getActiveHome from gateway in IM). */
export const profilePort = createProfilePort()
