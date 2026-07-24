# Hermes brain under InteractiveMode

**Stamp:** 2026-07-23 · **Cadillac:** `CADILLAC.md`  
**Companion:** `HERMES_GUT_PLAN.md` P2, `INTEGRATION_CROSSOVERS.md` §9–10, `TUI_PARITY_AUDIT.md`

## Product sentence

Hermes owns the agent loop. OMP InteractiveMode is the coat. One launch: `omherm`.

## What landed

| Piece | Path | Role |
|-------|------|------|
| `HermesBrain` | `packages/hermes-bridge/src/hermes-brain.ts` | Port: bootstrap gateway, `prompt`/`interrupt`/`slashExec`, dialog host, map events via `GatewayTurnMapper` |
| Install | `packages/coding-agent/src/modes/hermes-brain-install.ts` | Replaces session `prompt` / `followUp` / `abort` / `subscribe` fan-in / `isStreaming` |
| Wire | `packages/coding-agent/src/main.ts` | Before `runInteractiveMode` when brain enabled |
| Dialog host | `interactive-mode.ts` `#attachHermesDialogHost` | clarify/approval → OMP ask-dialog |
| Slash router | `hermes-slash-router.ts` + `input-controller` | deep-link `/settings` `/model` `/kanban` `/cron` `/profile`; else `slash.exec` |
| Port forms | `hermes-port-list.ts` | Cron create/edit · Kanban create/assign |
| Edge mapper | `session-event-map.ts` | UiEvent → EventController subset (tested) |

## Enablement

| Env | Effect |
|-----|--------|
| default `omherm` (`MESHINA_TUI_BRAND=hermes`) | **Hermes brain ON** |
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
| Slash deep-links | Coat selectors/port overlays |
| Other slash | Gateway `slash.exec` via brain |
| Approvals / clarify | OMP ask-dialog → `approval.respond` / `clarify.respond` |
| OMP AgentSession.prompt | **Never called** for user turns |
| Transcript of record | Hermes session store (OMP session files = coat bookmarks only) |

## Named debt

1. **Not a full AgentSession facade** — chrome still holds a real OMP session for settings/title/`!bash`. Exit: narrow `CockpitSession` interface.  
2. **Synthetic OMP prompts rejected** (plan/vibe auto-prompts) — fail loud notice until ported.  
3. **followUp while streaming** = interrupt then new turn (no true Hermes `session.steer` yet) — dogfood may already use gateway steer path.  
4. ~~Approvals / clarify notices only~~ **shipped** ask-dialog host (sudo/secret still missing).  
5. ~~Slash execution~~ **shipped** router + `slash.exec` (skill names may still need dogfood).  
6. ~~Port create/edit~~ **shipped** basic field forms; rich Herm cron-editor fields (skills/toolsets/script multi-line) next; Profiles still inventory.  
7. **Config write lane (Herm parity)** — ~~CLI-only~~ **shipped 2026-07-24:** `config-lane.ts` (RPC_ALIAS from Herm `lane.ts`); `HermesConfigPort.set` routes hot keys via gateway `config.set`; brain install attaches gateway. Cold keys still CLI.  
8. **Settings text rows** — never call OMP `settings.get/set` on `hermes:*` paths. Values: HermesConfigPort cache only.  
9. **slash.exec output** — currently notice + status; pager overlay like Herm is nicer for long help.  
10. **Sessions list/resume** still OMP chrome — **named debt 2026-07-24:** coat bookmarks only under Hermes brain; exit = gateway `session.list` / resume via brain or hide resume + label. See `docs/REMAINING_WORK.md` §Sessions SoT.  
11. **Tool slab chrome** — Hermes aliases + **framed generic fallback** for all other tools (`generic-tool-render.ts` via `resolveToolRenderer`). Named: terminal→bash, read_file→read, web_search/extract, browser_*, execute_code→eval, …. Remaining: gateway `result` JSON density; polish titles/icons per tool family.  
12. ~~Kaomoji in transcript~~ **fixed 2026-07-23** — `thinking.delta` → `working_status` → OMP `setWorkingMessage` (loader above footer). Real model reason = `reasoning.delta` only.
13. **Perf (2026-07-24 pass A)** — skills/tools list + memory status TTL cache (8s, invalidate on mutation); inventory hover coalesce; Hermes usage refresh bumps `contextUsageRevision` for status-line context%.
14. ~~Role-model keyboard cycle OMP registry~~ **fixed 2026-07-24** — `cycleHermesModel` + `pickNextHermesModelRow`.
15. ~~**Boot bloat**~~ **partial 2026-07-24** — interactive Hermes path applies `hermes-coat-boot.ts`: empty `toolNames` + `restrictToolNames`, MCP/LSP/IRC off, skip OMP extension discovery + model registry refresh. Still constructs AgentSession host for chrome/`!bash`. Next: smaller system prompt / CockpitSession facade.

## Dogfood gate

1. `omherm`  
2. Notice: hermes-brain installed + model  
3. One real user message → assistant stream + tools  
4. Esc interrupts Hermes turn  
5. `/settings` · `/kanban` · `/cron` · `/profile` open coat surfaces  
6. `/status` or `/help` via slash.exec without starting a chat turn  
7. Forced approval (if tools require) opens ask-dialog, not silent deny  
8. Cron `n` new job form · Kanban `n` new task form  

Escape if gateway down: set `MESHINA_TUI_OMP_BRAIN=1` and file the failure.

## Tests

```bash
bun test packages/hermes-bridge
```

Includes mapper, brain feed path, slash router, kanban/cron parsers, config/profile ports.
