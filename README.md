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

## Engineering bar (binding)

**`docs/CADILLAC.md`** — public-scrutiny quality for the entire repo. Hermes owns brain and board; this repo owns the coat and thin ports. Named debt only. Pride test before merge.

**`docs/SETTINGS_REMAP.md`** — OMP settings schema is **not** Hermes. Product mtui filters/purges pi-agent keys.  
**`docs/HERMES_OMP_SETTINGS_MAP.md`** — Herm Config groups → OMP `/settings` tabs (implementation: `hermes-omp-settings-map.ts`). Model hub via Settings → Model → Open model selector.

Kanban: **`docs/KANBAN_PORT.md`**. Cron: **`docs/CRON_PORT.md`**. Profiles: **`docs/PROFILE_PORT.md`**. Crossovers: `docs/INTEGRATION_CROSSOVERS.md`.

## Identity

Product strings: **Hermes** / **mtui**. Internal packages may still say `@oh-my-pi/*` (coat). Upstream OMP tip: `.omp-upstream-sha`.
