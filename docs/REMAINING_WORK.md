# Remaining work — mtui M1′ (concrete)

**Stamp:** 2026-07-24 ~11:40 EDT · tip includes `6b47bcd` perf B + quick-access chips · Cadillac: Hermes brain, OMP coat, one launch `mtui`.

**Next-session brief (perf + residual):** [`docs/HANDOFF_PERF_WAVE_B.md`](./HANDOFF_PERF_WAVE_B.md)  
**Parallel sessions:** do **not** edit `~/meshina` hub `plans/HANDOFF.md` / model-lineup from a TUI session.

Dogfood mouse/chrome + P1 dashboard + **P2 inventory/mapper** landed. Relaunch `mtui` after coat/bridge edits (no HMR).

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
| Profile CLI | async `Bun.spawn` (no spawnSync on TUI path) |
| Kanban board switch / slash pager | shipped |

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
| 5b | Kanban **board switch** | **shipped** — `listBoards` / `switchBoard` + UI `B` / Board form |
| 7 | Sessions picker = Hermes `session.list` / resume | **partial** — list + picker; **resume wire still open** |
| 8 | Live `config.set` for hot keys | CLI-only today; ConfigPort exists |
| 10b | Status line live refresh | revision bump after turn_end |

### Sessions SoT debt (Cadillac #7)

**Fingerprint:** OMP `showSessionSelector` / coat session files are **bookmarks only** while Hermes brain is ON. Transcript of record = Hermes session store via gateway.

| Field | Value |
|-------|--------|
| Owner | Hermes `session.*` RPC (preferred) + `sessionsPort` CLI list |
| Current | Hermes sessions overlay lists; resume path still incomplete vs coat bookmarks |
| Exit | Wire selector to Hermes sessions + gateway resume/create |
| Tracked | this file + `docs/HERMES_BRAIN.md` debt #10 + `HANDOFF_PERF_WAVE_B.md` |

---

## P2 — polish / mapper

| # | Item | Status |
|---|------|--------|
| 11–16 | Skills/tools/memory/trail/mapper/image/slash | **shipped** |
| slash.exec pager | **shipped** `HermesTextOverlay` + tmp dump |
| Quick-access bar | **shipped** multi-chip + tight layout |

Dogfood: `docs/DOGFOOD_CHECKLIST.md`

---

## Perf — wave B2 (next; see HANDOFF_PERF_WAVE_B)

| Done | Next (ordered) | Skip / non-goal |
|------|----------------|-----------------|
| Pass A TTL + hover coalesce | **B2.1** `MTUI_PERF=1` render counters | Markdown lex fork (pi-tui L1/L2 OK) |
| Pass B height cache + frame LRU + slash Map + ascii pad | **B2.2** chrome/editor height note after grow | React flushSync / Activity (wrong stack) |
| Shell microtask paint (bridge shell only) | **B2.3** thinking-header hit map cache | SettingsList internals upstream |
| | **B2.4** Hermes brain paint coalesce in IM | Dual brain / Herm tab strip |
| | **B2.5** overlay `#paintLocal` audit | Hub model-lineup |

---

## P3 — explicit non-goals

Dual brain, Herm top tab bar, plasma-fractal OS, web dashboard chase, plain-wheel chat without mouse tradeoff (native scrollback vs SGR).

---

## Cadillac checklist

- Ownership: board/cron/profile/skills/tools writes only via ports  
- No Herm React tab strip / second coordinator  
- Sessions dual-SoT **named + exit** (above)  
- Debt named here if deferred  
- **Relaunch `mtui` after coat/bridge edits** (no hot reload)  
- **Parallel:** hub HANDOFF / VITALS / Config A* = other session  
