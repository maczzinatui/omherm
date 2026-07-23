# meshina-tui

**Hermes Agent cockpit.** Visual coat = OMP InteractiveMode. Brain target = Hermes gateway.

## Confusion fix (2026-07-23)

| Command | What you get |
|---------|----------------|
| **`mtui`** | **Full OMP InteractiveMode chrome** (looks like the clone) + Hermes **branding** (`hermes/0.1.0-hermes`). Brain is still OMP AgentSession until gut finishes. |
| `mtui --bridge` | Thin Hermes-gateway shell (experimental). Looks bare — **not** the dogfood default. |

We briefly made `--bridge` the only path; that **was** a visual regression. Default is full coat again.

## Run

```bash
cd ~/meshina-tui
git pull && bun install && ./scripts/bootstrap-local-artifacts.sh
mtui --version    # hermes/0.1.0-hermes
mtui              # full OMP UI
```

## Gut plan

`docs/HERMES_GUT_PLAN.md` — plug Hermes under InteractiveMode; settings for kanban (no Herm top bar).  
Bridge code: `packages/hermes-bridge` (used by `--bridge` today; target for default path later).

## Identity

Product strings: **Hermes** / **mtui**. Internal packages may still say `@oh-my-pi/*` (coat). Upstream OMP tip: `.omp-upstream-sha`.
