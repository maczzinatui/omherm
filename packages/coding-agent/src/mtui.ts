#!/usr/bin/env bun
/**
 * mtui — Hermes Agent cockpit entry.
 * Coat: OMP/pi-tui chrome. Brain: Hermes tui_gateway.
 * No OMP/Pi product branding on this path.
 */
import { applyHermesBrandEnv, PRODUCT_CLI, PRODUCT_VERSION } from "./hermes-brand.ts"

applyHermesBrandEnv()

const args = process.argv.slice(2)
if (args.includes("-h") || args.includes("--help")) {
  process.stdout.write(`${PRODUCT_CLI} — Hermes Agent cockpit

Usage:
  mtui
  HERMES_TUI_GATEWAY_URL=ws://host:port mtui

Env:
  HERMES_AGENT_ROOT     default ~/.hermes/hermes-agent
  HERMES_PYTHON         python for tui_gateway
  HERMES_CWD            agent working directory
  HERMES_TUI_GATEWAY_URL  remote gateway WS

In-session:
  /quit  /exit  /interrupt
`)
  process.exit(0)
}
if (args.includes("-V") || args.includes("--version")) {
  process.stdout.write(`hermes/${PRODUCT_VERSION}\n`)
  process.exit(0)
}

// Ensure local workspace packages resolve
import { runHermesShell } from "./modes/hermes-interactive-shell.ts"

await runHermesShell()
