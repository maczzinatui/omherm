# Remaining work — omherm M1′ (concrete)

**Stamp:** 2026-07-24 ~12:45 EDT · tip `9e49754` + **dirty B2.1–B2.5** (uncommitted) · Cadillac: Hermes brain, OMP coat, one launch `omherm`.

**Next-session brief (perf + residual):** [`docs/HANDOFF_PERF_WAVE_B.md`](./HANDOFF_PERF_WAVE_B.md)  
**Parallel sessions:** do **not** edit `~/meshina` hub `plans/HANDOFF.md` / model-lineup from a TUI session.

Dogfood mouse/chrome + P1 dashboard + **P2 inventory/mapper** landed. Relaunch `omherm` after coat/bridge edits (no HMR).

---

## Landed this arc (do not re-do)

| Area | What |
|------|------|
| Mouse/chrome dogfood | top-left overlays, async ports, hover sidebar, Esc stack, quick-access chips (Settings·Kanban·Sessions·Model) |
| P1 cron / kanban comment / profile confirm / steer / context% | `0a66cfc` + follow-ups |
| P2 Skills/Tools/Memory **ports** | `ee48c33` / `5a34482` / `6bbc1ab` |
| P2 overlays + mapper + trail + image + slash | inventory crash-harden + siblings |
| Perf pass A | 8s TTL list cache (skills/tools/memory status); mutations invalidate; inventory hover coalesce; status-line `contextUsageRevision` after Hermes `refreshInfo` |
| Perf pass B (`6b47bcd`) | mouse height WeakMap + assistant/tool note; splash frame LRU; slash cmd Map; ASCII pad |
| **Perf B2.1–B2.5 (dirty, await commit)** | counters; height sum + editor note; thinking hit cache; coalesce; **overlay-paint** + soft reload local + hover coalesce + model-hub local |
| Profile CLI | async `Bun.spawn` (no spawnSync on TUI path) |
| Kanban board switch / slash pager | shipped |

---

## P0 — product safety (still live dogfood)

| # | Item | Why | Owner path |
|---|------|-----|------------|
| 1 | Approvals + clarify → ask-dialog e2e | safety UX | ask-dialog + bridge |
| 2 | Slash.exec live gateway results | pager only without live | router + brain |
| 3 | Port mutations fail-loud under CLI death | silent fail | port-list banners |

---

## P1 — sessions / config / status

| # | Item | Status |
|---|------|--------|
| Sessions resume SoT | list partial; resume incomplete |
| Live `config.set` hot keys | ConfigPort |
| Status-line invalidate after usage | revision path partial |

---

## P2 — polish / mapper

| # | Item | Status |
|---|------|--------|
| 11–16 | Skills/tools/memory/trail/mapper/image/slash | **shipped** |
| slash.exec pager | **shipped** `HermesTextOverlay` + tmp dump |
| Quick-access bar | **shipped** multi-chip + tight layout |

Dogfood: `docs/DOGFOOD_CHECKLIST.md`

---

## Perf — wave B2

| Done | Next | Skip / non-goal |
|------|------|-----------------|
| Pass A TTL + hover coalesce | Operator dogfood B2 dirty + commit | Markdown lex fork |
| Pass B height + frame LRU + slash Map | Live `MTUI_PERF=1` stream receipt optional | React flushSync / Activity |
| **B2.1–B2.5 dirty** | Product P0 residual | Dual brain / Herm tab strip |
| Shell microtask (bridge shell) | pi-tui overlay partial-compose (upstream) | Hub model-lineup |

Tip debt (not B2): 3× `tool-execution-spinner` “does not tick …” fails on main.

---

## P3 — explicit non-goals

Dual brain, Herm top tab bar, plasma-fractal OS, web dashboard chase, plain-wheel chat without mouse tradeoff (native scrollback vs SGR).

---

## Cadillac checklist

- Ownership: board/cron/profile/skills/tools writes only via ports  
- No Herm React tab strip / second coordinator  
- Sessions dual-SoT **named + exit** (above)  
- Debt named here if deferred  
- **Relaunch `omherm` after coat/bridge edits** (no hot reload)  
- **Parallel:** hub HANDOFF / VITALS / Config A* = other session  
