# meshina-tui

**OMP-class terminal cockpit for Hermes Agent.**

Separate product repo (same shape as Herm): this tree is a **renderer**. Hermes is the **brain**. Do not vendor OMP agent runtime. Do not fork `hermes-agent`.

| Layer | Owns |
|-------|------|
| **UI** | `@oh-my-pi/pi-tui` (tape / differential render) — OMP *shape*, not OMP body |
| **Chrome** | Herm-class **top toolbar**: Chat, Sessions, Kanban, Models, Config, Skills, Toolsets, Agents, Cron, Memory, Context — all over gateway RPCs |
| **Primary wire** | Hermes `tui_gateway` JSON-RPC (stdio child or remote WS) — full chrome |
| **Optional wire** | `hermes acp` — editor / embed parity, not the daily path |
| **Backend** | Upstream Hermes only (`~/.hermes/hermes-agent`) |

## Why gateway chrome first

ACP is enough for “one agent turn in a generic client.” It is **not** enough for a robust operator cockpit:

- profile / `HERMES_HOME` respawn
- live tools + skills catalogs
- clarify / approval / secret / sudo prompts
- voice, kanban shell-outs, cron, delegation status
- session list / resume / interrupt / steer
- context / usage / skin / notifications

Herm already speaks that protocol. meshina-tui reimplements a **clean client** against the same wire and paints it with pi-tui.

```text
┌──────────────────────────────┐
│  meshina-tui (this repo)     │  pi-tui shell + turn timeline + footer
└──────────────┬───────────────┘
               │ JSON-RPC 2.0 (stdio NDJSON or WS /api/ws)
               ▼
┌──────────────────────────────┐
│  tui_gateway / hermes serve  │  skills · memory · mesh · kanban · voice
└──────────────────────────────┘
```

## Status (M1′)

Spike track:

1. **Event map** — gateway events → assistant timeline + footer model (`docs/EVENT_MAP.md`)
2. **One real turn** — thinking + tool + text rendered live through pi-tui
3. **Dogfood** — operator daily path before any cutover from stock Hermes TUI

Parked: Herm OpenTUI fork (`~/herm` `feat/eikon-cut`) — reference only, do not delete.

## Quick start

```bash
bun install
bun run start          # spawns tui_gateway from ~/.hermes/hermes-agent
# or attach to a running gateway:
HERMES_TUI_GATEWAY_URL=ws://127.0.0.1:8733 bun run start
```

Requires: Bun ≥ 1.3, working Hermes install (`hermes` on PATH / `~/.hermes/hermes-agent`).

## Non-goals

- Vendoring OMP coding-agent / providers / hashline / DAP
- Modifying `~/.hermes/hermes-agent`
- Absorbing meshina ops into this repo
- Replacing Hermes as multi-agent coordinator

## Mesh ops context

Living handoff lives in the meshina repo (`plans/HANDOFF.md`, kanban M1′). This README is product-facing only.
