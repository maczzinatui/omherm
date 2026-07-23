# Hermes brain under InteractiveMode

**Stamp:** 2026-07-24 · **Cadillac:** `CADILLAC.md`  
**Companion:** `HERMES_GUT_PLAN.md` P2, `INTEGRATION_CROSSOVERS.md` §9–10

## Product sentence

Hermes owns the agent loop. OMP InteractiveMode is the coat. One launch: `mtui`.

## What landed

| Piece | Path | Role |
|-------|------|------|
| `HermesBrain` | `packages/hermes-bridge/src/hermes-brain.ts` | Port: bootstrap gateway, `prompt`/`interrupt`, map events via `GatewayTurnMapper` |
| Install | `packages/coding-agent/src/modes/hermes-brain-install.ts` | Replaces session `prompt` / `followUp` / `abort` / `subscribe` fan-in / `isStreaming` |
| Wire | `packages/coding-agent/src/main.ts` | Before `runInteractiveMode` when brain enabled |
| Edge mapper | `session-event-map.ts` | UiEvent → EventController subset (tested) |

## Enablement

| Env | Effect |
|-----|--------|
| default `mtui` (`MESHINA_TUI_BRAND=hermes`) | **Hermes brain ON** |
| `MESHINA_TUI_OMP_BRAIN=1` | Escape hatch: OMP AgentSession loop (coat dogfood only) |
| `MESHINA_TUI_HERMES_BRAIN=0` | Force off |
| install failure | Fail open to OMP loop + log error (operator not locked out) |

## Ownership (no dual writers)

| Concern | Owner after install |
|---------|---------------------|
| User turns / tools / skills execution | **Hermes** gateway only |
| Turn paint (assistant, tools, thinking) | EventController via mapped events |
| Optimistic user bubble | InteractiveMode (coat) |
| `!` bash / local python | Coat local (not Hermes tools) |
| Settings chrome | Coat + HermesConfigPort / ports |
| OMP AgentSession.prompt | **Never called** for user turns |
| Transcript of record | Hermes session store (OMP session files = coat bookmarks only — do not dual-write turns) |

## Named debt

1. **Not a full AgentSession facade** — chrome still holds a real OMP session for settings/title/`!bash`. Exit: narrow `CockpitSession` interface + delete unused AgentSession surface on product path.  
2. **Synthetic OMP prompts rejected** (plan/vibe auto-prompts) — fail loud notice until ported.  
3. **followUp while streaming** = interrupt then new turn (no true Hermes steer queue yet).  
4. **Approvals / clarify** map to notices only — wire OMP ask-dialog next.  
5. **Slash execution** — autocomplete lists Hermes skills; OMP builtins still local; remaining `/foo` should reach Hermes as text (verify dogfood).  
6. **Port panels** — Kanban/Cron/Profiles are **inventory** overlays (CLI read); create/edit editors are next slices per port docs.

## Dogfood gate

1. `mtui`  
2. Notice or log: hermes-brain installed + model  
3. One real user message → assistant stream + tools in full OMP chrome  
4. Esc interrupts Hermes turn  
5. `/settings` → Tasks → Open Kanban/Cron/Profiles lists load without crash  

Escape if gateway down: set `MESHINA_TUI_OMP_BRAIN=1` and file the failure.

## Tests

```bash
bun test packages/hermes-bridge
```

Includes mapper, brain feed path, kanban/cron parsers, config/profile ports.
