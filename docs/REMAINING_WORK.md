# Remaining work — mtui M1′ (concrete)

**Stamp:** 2026-07-24 (P2 landed `e99cba2` + perf pass A) · Cadillac: Hermes brain, OMP coat, one launch `mtui`.

Dogfood mouse/chrome + P1 dashboard + **P2 inventory/mapper** landed. Relaunch `mtui` after coat/bridge edits (no HMR).

---

## Landed this arc (do not re-do)

| Area | What |
|------|------|
| Mouse/chrome dogfood | top-left overlays, async ports, hover sidebar, Esc stack, quick-access chip |
| P1 cron / kanban comment / profile confirm / steer / context% | `0a66cfc` + follow-ups |
| P2 Skills/Tools/Memory **ports** | `ee48c33` / `5a34482` / `6bbc1ab` |
| P2 overlays + mapper + trail + image + slash | `e99cba2` (crash-hardened inventory) |
| Perf pass A | 8s TTL list cache (skills/tools/memory status); mutations invalidate; inventory hover coalesce; status-line `contextUsageRevision` bump after Hermes `refreshInfo` |
| Profile CLI | already async `Bun.spawn` (no spawnSync on TUI path) |

---

## P0 — product safety (still live dogfood)

| # | Item | Why | Owner path |
|---|------|-----|------------|
| 1 | **Approvals + clarify → ask-dialog** end-to-end dogfood | Unsafe if notices-only | `ask-dialog.ts` + bridge events |
| 2 | **Slash exec** deep-link + result path | Fake if autocomplete only | slash router + brain |
| 3 | **Port mutations fail-loud** | Partially done (banners); dogfood archive/complete CLI death | `hermes-port-list` |

Headless smoke (2026-07-24): slash routes OK; skills 82 / tools 24 / memory ports OK; mapper subagent→notice; bridge **82+** tests.

---

## P1 — residual

| # | Item | Notes |
|---|------|--------|
| 5b | Kanban **board switch** | Comment done; board picker still open |
| 7 | Sessions picker = Hermes `session.list` / resume | **Named debt** — see below |
| 8 | Live `config.set` for hot keys | CLI-only today; ConfigPort exists |
| 10b | Status line live refresh | **partial** — revision bump after turn_end; coat may still need IM tick |

### Sessions SoT debt (Cadillac #7)

**Fingerprint:** OMP `showSessionSelector` / coat session files are **bookmarks only** while Hermes brain is ON. Transcript of record = Hermes session store via gateway.

| Field | Value |
|-------|--------|
| Owner | Hermes `session.*` RPC (preferred) |
| Current | OMP chrome list/resume — does **not** switch Hermes gateway session |
| Exit | Wire selector to `session.list` + resume/create via brain; or hide resume under brain and label “coat bookmarks” |
| Fail-loud | Do not claim “session switched” for Hermes turns until RPC path lands |
| Tracked | this file + `docs/HERMES_BRAIN.md` debt #10 |

---

## P2 — polish / mapper

| # | Item | Status |
|---|------|--------|
| 11–16 | Skills/tools/memory/trail/mapper/image/slash | **shipped** `e99cba2` |

Dogfood still required after relaunch (skills crash fixed).

---

## P3 — explicit non-goals

Dual brain, Herm top tab bar, plasma-fractal OS, web dashboard chase, plain-wheel chat without mouse tradeoff (native scrollback vs SGR).

---

## Perf residual

| Done | Still optional |
|------|----------------|
| Kanban/cron/profile CLI **async** | Overlay dirty-rect paint (TUI compose) |
| Skills/tools/memory list **TTL cache** | Gateway event coalesce at brain |
| Inventory hover throttle | Skills list `--json` upstream ask |
| Soft reload no loading flash | slash.exec pager overlay |

---

## Cadillac checklist

- Ownership: board/cron/profile/skills/tools writes only via ports  
- No Herm React tab strip / second coordinator  
- Sessions dual-SoT **named + exit** (above)  
- Debt named here if deferred  
- **Relaunch `mtui` after coat/bridge edits** (no hot reload)  
