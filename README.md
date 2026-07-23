# meshina-tui

**Hermes cockpit built by gutting OMP’s TUI, not rebuilding it.**

Upstream base: [can1357/oh-my-pi](https://github.com/can1357/oh-my-pi) (MIT) · tip recorded in `.omp-upstream-sha`.  
Product goal: OMP interactive surface + Hermes `tui_gateway` backend. Hermes agent source stays upstream/untouchable.

## Launch (target)

| Command | Meaning |
|---------|---------|
| **`mtui`** | Primary launcher (Hermes backend) |
| `meshina-tui` | Same |

Until the gut lands, `omp` from this tree is still stock OMP (dev reference).

## Strategy (binding)

1. **Vendor full OMP monorepo packages needed for interactive TUI** (this tree).
2. **Do not rebuild** footer / assistant-message / status-line / themes from scratch.
3. **Gut** `AgentSession` / provider / tool harness as the execution brain.
4. **Plug** Hermes `tui_gateway` JSON-RPC (stdio/WS) as the session + turn driver.
5. Keep Herm OpenTUI fork parked (`~/herm` `feat/eikon-cut`) — reference only.

Detail: [`docs/HERMES_GUT_PLAN.md`](docs/HERMES_GUT_PLAN.md)

## Layout

```
packages/coding-agent/   # InteractiveMode + components (primary work)
packages/tui/            # @oh-my-pi/pi-tui
packages/agent/          # pi-agent-core — replace behind adapter
packages/ai/             # providers — strip from product path
packages/utils/ wire/ …
docs/HERMES_GUT_PLAN.md
docs/UPSTREAM-OMP-README.md
.omp-upstream-sha
```

## Dev

```bash
cd ~/meshina-tui
bun install
# stock OMP UI (reference while gutting):
bun run --filter @oh-my-pi/pi-coding-agent start
# or:
bun packages/coding-agent/src/cli.ts
```

## License

OMP MIT — see `LICENSE`. Meshina product commits retain MIT; attribute upstream in README.
