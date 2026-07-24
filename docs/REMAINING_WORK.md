# Remaining work — mtui M1′ (concrete)

**Stamp:** 2026-07-24 (P2 ports + overlays + mapper + image path) · Cadillac: Hermes brain, OMP coat, one launch `mtui`.

Dogfood mouse/chrome + P1 dashboard + **P2 inventory/mapper** landed. Relaunch `mtui` after coat/bridge edits (no HMR).

---

## Landed this arc (do not re-do)

| Area | What |
|------|------|
| Mouse/chrome dogfood | top-left overlays, async ports, hover sidebar, Esc stack, quick-access chip |
| P1 cron / kanban comment / profile confirm / steer / context% | `0a66cfc` + follow-ups |
| P2 Skills port | `skills-port.ts` + tests (`ee48c33`) |
| P2 Tools port | `tools-port.ts` + tests (`5a34482`) |
| P2 Memory port | `memory-port.ts` + tests (`6bbc1ab`) |
| P2 Mapper gap | GatewayEvent/UiEvent + GatewayTurnMapper notices/working_status only (never transcript noise); unit tests |
| P2 Skills/Tools/Memory overlays | `hermes-inventory-list.ts` + settings launchers + `/skills` `/tools` `/memory` slash intercepts |
| P2 Subagent trail | `subagent-trail.ts` store + overlay; brain subscribe feed; `/subagents` |
| P2 Image attach | Hermes brain path: clipboard → `~/.hermes/tmp/mtui-paste/` + editor path marker (no fake gateway RPC) |
| P2 Slash extras | bare `/skills|/tools|/memory|/subagents` → overlays; `/yolo|/compress|/goal|/browser` stay slash.exec |

---

## P0 — product safety (still dogfood)

| # | Item | Why | Owner path |
|---|------|-----|------------|
| 1 | **Approvals + clarify → ask-dialog** end-to-end dogfood | Unsafe if notices-only | `ask-dialog.ts` + bridge events |
| 2 | **Slash exec** deep-link + result path | Fake if autocomplete only | slash router + brain |
| 3 | **Port mutations fail-loud** | Partially done (banners); dogfood archive/complete CLI death | `hermes-port-list` |

## P1 — residual

| # | Item | Notes |
|---|------|--------|
| 5b | Kanban **board switch** | Comment done; board picker still open |
| 7 | Sessions picker = Hermes `session.list` / resume | OMP chrome, Hermes SoT |
| 8 | Live `config.set` for hot keys | CLI-only today; ConfigPort exists |
| 10b | Status line live refresh tick after usage patch | Override present; may need status-line invalidate on refreshInfo |

## P2 — polish / mapper

| # | Item | Status |
|---|------|--------|
| 11 | Skills + toolsets panels | **shipped** inventory overlay |
| 12 | Memory panel | **shipped** |
| 13 | Subagent trail cards | **shipped** (store + overlay) |
| 14 | Mapper gap events | **shipped** + tests |
| 15 | Image attach | **shipped** Hermes path marker |
| 16 | Slash extras | **shipped** intercepts + exec passthrough |

Dogfood still required after relaunch.

## P3 — explicit non-goals

Dual brain, Herm top tab bar, plasma-fractal OS, web dashboard chase, plain-wheel chat without mouse tradeoff (native scrollback vs SGR).

---

## Perf residual

| Done | Still optional |
|------|----------------|
| Kanban/cron CLI **async spawn** | Profile CLI audit if any spawnSync left |
| Port UI: no `show` on every select | Overlay dirty-rect paint (TUI compose) |
| Soft reload no loading flash | Motion hover rAF throttle |

---

## Cadillac checklist

- Ownership: board/cron/profile/skills/tools writes only via ports  
- No Herm React tab strip / second coordinator  
- Debt named here if deferred  
- **Relaunch `mtui` after coat/bridge edits** (no hot reload)  
