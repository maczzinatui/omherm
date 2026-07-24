# omherm

**OMP coat + Hermes brain.** A terminal UI that runs [Oh My Pi](https://github.com/can1357/oh-my-pi) InteractiveMode chrome against a [Hermes Agent](https://github.com/NousResearch/hermes-agent) gateway — not a second agent runtime.

**Name:** *om* (oh-my-pi) + *herm* (Hermes). Pronounce it however you like.

| Layer | Source | Role |
|-------|--------|------|
| Visual coat / TUI / settings chrome | Fork of **[can1357/oh-my-pi](https://github.com/can1357/oh-my-pi)** (`@oh-my-pi/*`) | InteractiveMode, themes, keybinds, overlays |
| Brain / board / ports target | **Hermes** (gateway + CLI) | Sessions, kanban, cron, skills, model config |
| Product UX inspiration | **[liftaris/herm](https://github.com/liftaris/herm)** | Density, settings grouping, cockpit feel — *not* a React dual-brain |

This repo is the **coat and thin ports**. Hermes owns cognition and the board. Upstream OMP packages keep their names and MIT copyrights; omherm is the product packaging and Hermes integration on top.

## Why it exists

People want a full-featured agent TUI without abandoning Hermes as the brain. Stock OMP is excellent chrome; Hermes is the mesh/gateway agent. **omherm** glues them: same muscle memory as OMP, Hermes branding and ports, no second coordinator UI.

## Requirements

- [Bun](https://bun.sh) (see root `package.json` `packageManager`)
- A working [Hermes](https://hermes-agent.nousresearch.com/) install for gateway features (kanban, sessions resume, etc.)
- Linux or macOS terminal with a decent Unicode font (braille splash optional)

## Install / run

```bash
git clone https://github.com/maczzinatui/omherm.git
cd omherm
bun install
./scripts/bootstrap-local-artifacts.sh   # if present / needed for natives
./scripts/omh --version
./scripts/omh                            # full OMP chrome, Hermes brand
```

Optional install into `~/.bun/bin`:

```bash
ln -sf "$(pwd)/scripts/omh" ~/.bun/bin/omh
ln -sf "$(pwd)/scripts/omherm" ~/.bun/bin/omherm   # full name
```

| Command | What you get |
|---------|----------------|
| **`omh`** | Short daily command — full OMP InteractiveMode + Hermes brand |
| `omherm` | Same product (full name) |
| `omh --bridge` | Thin Hermes-gateway shell (experimental; not the dogfood default) |
| `omp` | Stock Oh My Pi (separate binary from upstream packages) |

Default path is the **full coat**. Do not make bare bridge the product face.

After coat or bridge edits: **quit and relaunch** (no HMR).

## Configuration

- On-disk settings still use the OMP layout (`.omp`) so coat settings work without a second schema war.
- Product mode filters pi-agent-only settings keys unless you set `OMHERM_RAW_OMP_SETTINGS=1`.
- Docs: `docs/SETTINGS_REMAP.md`, `docs/HERMES_OMP_SETTINGS_MAP.md`.

Env (preferred; older `MESHINA_TUI_*` aliases still work where wired):

| Preferred | Meaning |
|-----------|---------|
| `OMHERM_ROOT` | Repo root override for launcher |
| `OMHERM_VERSION` | Version string |
| `OMHERM_PERF=1` | Render / boot counters on stderr |
| `OMHERM_PAINT_COALESCE=1` | Force paint coalesce |
| `OMHERM_RAW_OMP_SETTINGS=1` | Unfiltered OMP settings schema |
| `OMHERM_EXPERIMENTAL_BRIDGE=1` | Thin bridge shell |
| `MESHINA_TUI_OMP_BRAIN=1` | Escape: OMP agent loop (coat-only dogfood) |

## Architecture (one screen)

```
┌─────────────────────────────────────────────┐
│  omherm (this repo)                         │
│  ┌───────────────────────────────────────┐  │
│  │ OMP InteractiveMode coat (@oh-my-pi)  │  │
│  │ themes · footer · settings · overlays │  │
│  └───────────────┬───────────────────────┘  │
│                  │ CockpitSession / ports   │
│                  ▼                          │
│         HermesBrain → gateway / CLI         │
└─────────────────────────────────────────────┘
```

- **`HermesBrain`** — owns turns (`prompt` / `interrupt` / events).
- **`CockpitSession`** — narrow facade for coat code (`info`, `onEvent`, `submit`, …). Prefer it over reaching into OMP `AgentSession` for Hermes facts.
- OMP `AgentSession` still hosts coat chrome (`!bash`, settings shell) until that host is fully peeled.

Internal packages may still be named `@oh-my-pi/*` — that is the coat. Upstream tip pin: `.omp-upstream-sha`.

## Documentation map

| Doc | Topic |
|-----|--------|
| [`docs/CADILLAC.md`](docs/CADILLAC.md) | Quality bar — public scrutiny, named debt only |
| [`docs/HERMES_GUT_PLAN.md`](docs/HERMES_GUT_PLAN.md) | Plug Hermes under InteractiveMode |
| [`docs/HERMES_BRAIN.md`](docs/HERMES_BRAIN.md) | Brain install + CockpitSession |
| [`docs/KANBAN_PORT.md`](docs/KANBAN_PORT.md) | Kanban port |
| [`docs/CRON_PORT.md`](docs/CRON_PORT.md) | Cron port |
| [`docs/PROFILE_PORT.md`](docs/PROFILE_PORT.md) | Profiles |
| [`docs/INTEGRATION_CROSSOVERS.md`](docs/INTEGRATION_CROSSOVERS.md) | Integration edges |
| [`docs/DOGFOOD_CHECKLIST.md`](docs/DOGFOOD_CHECKLIST.md) | Manual dogfood |
| [`docs/HANDOFF_PERF_WAVE_B.md`](docs/HANDOFF_PERF_WAVE_B.md) | Current product handoff |
| [`NOTICE`](NOTICE) | Third-party attributions |

Engineering pride test: if you would not show the diff in public, do not merge it.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Keep PRs focused; run relevant `bun test` paths; dogfood the TUI after coat changes (no HMR — quit and relaunch).

## License

[MIT](LICENSE).

- Coat and most packages: copyright retained from **Oh My Pi** authors (Can Bölük, Mario Zechner, and contributors) — see LICENSE and package headers.
- omherm product packaging, Hermes bridge, and documentation: additional copyright **Mac** / maczzinatui contributors as listed in LICENSE.
- Hermes Agent is a separate project with its own license; you need a Hermes install to use gateway features.

## Credits

- **[Oh My Pi](https://github.com/can1357/oh-my-pi)** — the TUI coat this product is built from.
- **[Herm](https://github.com/liftaris/herm)** — product inspiration for cockpit density and settings UX (not embedded as a dual UI).
- **[Hermes Agent](https://github.com/NousResearch/hermes-agent)** / [docs](https://hermes-agent.nousresearch.com/) — the brain and board this coat talks to.
- Everyone who dogfoods terminals for a living.
