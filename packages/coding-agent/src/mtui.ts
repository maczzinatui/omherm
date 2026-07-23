#!/usr/bin/env bun
/**
 * mtui — Hermes product entry over the OMP vendor tree.
 *
 * DEFAULT: full InteractiveMode (real OMP trench coat) + Hermes product branding.
 *   Looks like the OMP clone. Brain is still OMP AgentSession until Hermes is
 *   plugged under InteractiveMode without stripping the chrome.
 *
 * EXPERIMENTAL: --bridge = thin hermes-interactive-shell (gateway brain, plain
 *   transcript). Visual regression vs OMP — not default dogfood.
 */
import { applyHermesBrandEnv, PRODUCT_CLI, PRODUCT_VERSION } from "./hermes-brand.ts"

applyHermesBrandEnv()

const rawArgv = process.argv.slice(2)
const useBridge = rawArgv.includes("--bridge")
const args = rawArgv.filter((a) => a !== "--bridge")

if (args.includes("-h") || args.includes("--help")) {
	process.stdout.write(`${PRODUCT_CLI} — Hermes Agent cockpit

Usage:
  mtui              Full OMP InteractiveMode chrome + Hermes branding (default)
  mtui --bridge     Experimental thin Hermes-gateway shell (looks different)

Default path is the OMP coat. Hermes brain under that coat is still in progress
(bridge package exists; not default UI yet).

Env: HERMES_* / MESHINA_TUI_BRAND (launcher sets hermes)
`)
	process.exit(0)
}
if (args.includes("-V") || args.includes("--version")) {
	process.stdout.write(`hermes/${PRODUCT_VERSION}${useBridge ? " (bridge)" : ""}\n`)
	process.exit(0)
}

if (useBridge) {
	const { runHermesShell } = await import("./modes/hermes-interactive-shell.ts")
	await runHermesShell()
	process.exit(0)
}

// Full OMP InteractiveMode via existing CLI runner (branded hermes via dirs.ts)
const { runCli } = await import("./cli.ts")
await runCli(args)
