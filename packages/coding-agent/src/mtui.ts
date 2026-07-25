#!/usr/bin/env bun
/**
 * omh — Hermes Agent cockpit (ONE product launch path).
 *
 * Full OMP InteractiveMode chrome + themes + footer + settings.
 * Branding = Hermes. Brain = HermesBrain under the coat (OMP AgentSession is host chrome only).
 *
 * Want stock OMP? Run `omp` — not this binary.
 * Experimental gateway shell: OMHERM_EXPERIMENTAL_BRIDGE=1 / MESHINA_TUI_EXPERIMENTAL_BRIDGE=1 only.
 */
import { applyHermesBrandEnv, PRODUCT_CLI, PRODUCT_VERSION } from "./hermes-brand.ts"

applyHermesBrandEnv()

// Keep process.cwd() = operator workspace (mtui exports HERMES_CWD / OMHERM_LAUNCH_CWD).
// If a parent script still chdir'd into the coat tree, snap back before CLI boot
// so footer, SessionManager, and Hermes session.create share the same path.
{
	const launch =
		process.env.HERMES_CWD?.trim() ||
		process.env.OMHERM_LAUNCH_CWD?.trim() ||
		""
	if (launch) {
		try {
			const { realpathSync, statSync } = await import("node:fs")
			const resolved = realpathSync(launch)
			if (statSync(resolved).isDirectory() && process.cwd() !== resolved) {
				process.chdir(resolved)
			}
		} catch {
			/* leave cwd; Hermes still gets HERMES_CWD on session.create */
		}
	}
}

// Fail loud — silent black screens are unacceptable
process.on("uncaughtException", (err) => {
	console.error(`\n${PRODUCT_CLI} crash (uncaughtException):\n`, err)
	process.exit(1)
})
process.on("unhandledRejection", (err) => {
	console.error(`\n${PRODUCT_CLI} crash (unhandledRejection):\n`, err)
	process.exit(1)
})

const rawArgv = process.argv.slice(2)
// Legacy flag still accepted but not product path — same as env experimental
const legacyBridge = rawArgv.includes("--bridge")
const useBridge =
	legacyBridge ||
	process.env.MESHINA_TUI_EXPERIMENTAL_BRIDGE === "1" ||
	process.env.MESHINA_TUI_EXPERIMENTAL_BRIDGE === "true"
const args = rawArgv.filter((a) => a !== "--bridge")

if (args.includes("-h") || args.includes("--help")) {
	process.stdout.write(`${PRODUCT_CLI} — Hermes Agent cockpit

Usage:
  omh               Hermes cockpit (full OMP chrome + themes + footer)
  omh --version

Stock Oh-My-Pi: run \`omp\` separately. This binary is Hermes-only.

Themes, status-line footer, settings, keybinds: OMP coat (unchanged).
Brand mark in footer: Hermes (not π).
`)
	process.exit(0)
}
if (args.includes("-V") || args.includes("--version")) {
	process.stdout.write(`hermes/${PRODUCT_VERSION}\n`)
	process.exit(0)
}

if (useBridge) {
	// Internal/dev only — not the product face
	const { runHermesShell } = await import("./modes/hermes-interactive-shell.ts")
	await runHermesShell()
	process.exit(0)
}

// Product path: full InteractiveMode (OMP coat, Hermes brand)
const { runCli } = await import("./cli.ts")
await runCli(args)
