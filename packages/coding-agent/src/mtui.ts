#!/usr/bin/env bun
/**
 * mtui — Hermes Agent cockpit (ONE product launch path).
 *
 * Full OMP InteractiveMode chrome + themes + footer + settings.
 * Branding = Hermes. Brain = OMP AgentSession until Hermes is plugged under
 * this coat (bridge work is internal; not a second user-facing app).
 *
 * Want stock OMP? Run `omp` — not this binary.
 * Experimental gateway shell: MESHINA_TUI_EXPERIMENTAL_BRIDGE=1 only (not advertised).
 */
import { applyHermesBrandEnv, PRODUCT_CLI, PRODUCT_VERSION } from "./hermes-brand.ts"

applyHermesBrandEnv()

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
  mtui              Hermes cockpit (full OMP chrome + themes + footer)
  mtui --version

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
