// hermes profile CLI wrapper — all mutations go through here.

import { shellQuote } from "./profile-dto.ts"

export type CliResult = {
  code: number
  stdout: string
  stderr: string
  argv: string[]
}

export type RunHermes = (argv: string[], opts?: { timeoutMs?: number }) => Promise<CliResult>

const defaultRun: RunHermes = async (argv, opts) => {
  const timeoutMs = opts?.timeoutMs ?? 120_000
  const proc = Bun.spawn(["hermes", ...argv], {
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  })
  const timer = setTimeout(() => {
    try {
      proc.kill()
    } catch {
      /* */
    }
  }, timeoutMs)
  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    return { code, stdout, stderr, argv: ["hermes", ...argv] }
  } finally {
    clearTimeout(timer)
  }
}

export function buildProfileArgv(verb: string, args: string[] = []): string[] {
  return ["profile", verb, ...args]
}

/** Test helper: render a safe shell line (not used for spawn). */
export function formatProfileCommand(verb: string, args: string[] = []): string {
  return ["hermes", ...buildProfileArgv(verb, args)].map(shellQuote).join(" ")
}

export function createProfileCli(run: RunHermes = defaultRun) {
  const exec = async (verb: string, args: string[] = [], opts?: { timeoutMs?: number }) => {
    const argv = buildProfileArgv(verb, args)
    const r = await run(argv, opts)
    if (r.code !== 0) {
      const msg = (r.stderr || r.stdout || `hermes profile ${verb} failed`).trim()
      throw new Error(msg.slice(0, 500))
    }
    return r
  }

  return {
    exec,
    list: () => exec("list"),
    show: (name: string) => exec("show", [name]),
    use: (name: string) => exec("use", [name]),
    create: (name: string, extra: string[] = []) => exec("create", [name, ...extra]),
    delete: (name: string) => exec("delete", [name, "-y"]),
    describe: (name: string, text?: string) =>
      text === undefined ? exec("describe", [name]) : exec("describe", [name, text]),
    rename: (from: string, to: string) => exec("rename", [from, to]),
    update: (name: string, opts?: { forceConfig?: boolean }) =>
      exec("update", [name, "-y", ...(opts?.forceConfig ? ["--force-config"] : [])]),
    info: (name: string) => exec("info", [name]),
  }
}

export type ProfileCli = ReturnType<typeof createProfileCli>
