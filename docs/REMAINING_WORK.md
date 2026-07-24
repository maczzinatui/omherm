# Remaining work — mtui M1′ (concrete)

**Stamp:** 2026-07-24 ~02:50 EDT · Cadillac: Hermes brain, OMP coat, one launch `mtui`.

Dogfood mouse/chrome arc is **green enough to ship** after quit+relaunch verify. Below is **what is still real work**, not polish vibes.

---

## Ship gate (this WIP tree)

- [ ] Quit + relaunch `mtui` once more after opt sweep  
- [ ] Commit **meshina-tui only** (not hub HANDOFF unless intentional)  
- [ ] Tests: hermes-bridge + quick-access + thinking + settings layout (ports async)

---

## P0 — product safety / contract (do before calling M1′ done)

| # | Item | Why | Owner path |
|---|------|-----|------------|
| 1 | **Approvals + clarify → ask-dialog** end-to-end dogfood | Unsafe if notices-only | `ask-dialog.ts` + bridge events |
| 2 | **Slash exec** deep-link + `slash.exec` result path | Fake if autocomplete only | slash router + brain |
| 3 | **Port mutations fail-loud** (archive/complete when CLI dies) | Silent green = Cadillac fail | `hermes-port-list` banners |

## P1 — dashboard replacement (Settings Tasks / slash)

| # | Item | Notes |
|---|------|--------|
| 4 | Cron **last output** / run history panel | Port has `runs`; UI soft-loads only |
| 5 | Kanban **comment** + board switch | Port has comment; UI gaps |
| 6 | Profiles **switch confirm** in-UI | ProfilePort.use requires confirm |
| 7 | Sessions picker = Hermes `session.list` / resume | OMP chrome, Hermes SoT |
| 8 | Live `config.set` for hot keys | CLI-only today |
| 9 | `session.steer` while streaming | interrupt+new today |
| 10 | Status line ← gateway usage/context % | Coat bind |

## P2 — polish / mapper

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

## Perf residual (after this sweep)

| Done this pass | Still optional |
|----------------|----------------|
| Kanban/cron CLI **async spawn** (no event-loop freeze) | Profile CLI audit if any spawnSync left |
| Port UI: no `show` on every select | Kanban list cache + TTL |
| Soft reload no loading flash | Overlay dirty-rect paint (TUI: overlays force full compose today) |
| Drop triple requestRender on port dismiss | Motion hover rAF throttle if terminals flood 1003 |
| List-backed detail paint | |

Cadillac UX bar: *coalesce paint, seal scrollback, mutate in place* — TUI already coalesces; ports no longer block it.

---

## Cadillac checklist (touch-class)

- Ownership: board/cron/profile writes only via ports  
- No Herm React tab strip  
- No second coordinator  
- Debt named here if deferred  
