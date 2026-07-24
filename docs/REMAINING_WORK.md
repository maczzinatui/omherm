# Remaining work — mtui M1′ (concrete)

**Stamp:** 2026-07-24 (P1 ports + steer/context bind) · Cadillac: Hermes brain, OMP coat, one launch `mtui`.

Dogfood mouse/chrome arc shipped (`df4f1f3` + follow-ups). P1 dashboard slice landed this session (see below). Next session: **P2 polish / mapper**.

---

## Landed this arc (do not re-do)

| Area | What |
|------|------|
| Mouse/chrome dogfood | top-left overlays, async ports, hover sidebar, Esc stack, quick-access chip |
| P1 cron runs | richer `parseCronRunsOutput` + detail pane paint (`formatCronRunLine`); fail-loud runs refresh |
| P1 kanban comment | form + `m` hotkey → `kanbanPort.comment` |
| P1 profile confirm | use/delete confirms with `confirmSessionEnd` / `confirmDestroy` |
| P1 status context % | `getContextUsage` override from gateway usage; turn_end usage merge; refreshInfo on turn end |
| P1 session.steer | `gateway.steer` → brain.steer → followUp; fallback interrupt+prompt |

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

## P2 — polish / mapper (NEXT SESSION PRIMARY)

| # | Item |
|---|------|
| 11 | Skills + toolsets panels |
| 12 | Memory panel (USER/MEMORY) |
| 13 | Subagent trail cards |
| 14 | Mapper: btw, review.summary, background.complete, browser.progress, moa.* |
| 15 | Image attach / clipboard via gateway |
| 16 | `/yolo` `/compress` `/goal` `/browser` handlers |

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

- Ownership: board/cron/profile writes only via ports  
- No Herm React tab strip / second coordinator  
- Debt named here if deferred  
- **Relaunch `mtui` after coat/bridge edits** (no hot reload)  
