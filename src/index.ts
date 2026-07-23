#!/usr/bin/env bun
// meshina-tui — OMP-class cockpit for Hermes (gateway chrome primary)

import { runApp } from "./ui/app"

const args = process.argv.slice(2)
if (args.includes("-h") || args.includes("--help")) {
  console.log(`meshina-tui — Hermes cockpit (pi-tui + tui_gateway)

Usage:
  bun run start
  HERMES_TUI_GATEWAY_URL=ws://host:port bun run start

Env:
  HERMES_AGENT_ROOT   default ~/.hermes/hermes-agent
  HERMES_PYTHON       python for tui_gateway spawn
  HERMES_CWD          working directory for agent tools
  HERMES_TUI_GATEWAY_URL / HERM_GATEWAY_URL  remote WS instead of spawn

Commands in editor:
  /quit  /exit  /interrupt
`)
  process.exit(0)
}

await runApp()
