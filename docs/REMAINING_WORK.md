# Remaining work — omherm M1′ (concrete)

**Stamp:** 2026-07-24 ~16:20 America/Toronto · tip **`196c954`** (pushed) ·
**Updated:** 2026-07-24 ~22:35 (MiniMax 429 death closeout) tip **`f71c64b`** clean ·
hero wire + interrupt peel shipped · `/reasoning` footer three-bug ****shipped f71c64b****
**Next-session brief:** [`docs/HANDOFF_PERF_WAVE_B.md`](./HANDOFF_PERF_WAVE_B.md) §MiniMax death · perf: [`docs/PERF_SWEEP.md`](./PERF_SWEEP.md)
**Bar:** `docs/CADILLAC.md`
**Parallel:** mesh Config A3 / OCI cutover lives in `~/meshina/plans/HANDOFF.md` — **do not thrash** from a TUI-only session.

---

## Cadillac filter

| Gate | Implication |
|------|-------------|
| One brain | Dogfood Hermes dialog + slash + ports — not OMP dual path |
| One writer per fact | Hermes session model SoT; coat `session.model` is **paint mirror** via `hermes-coat-identity` |
| Ports only | Fail-loud in port UI |
| Named debt | History-after-resume, synthetic ctx windows — fingerprinted below |

---

## Landed (do not re-do)

| Area | Tip / note |
|------|------------|
| Sticky chips + chat scroll | `b2b98b0` |
| Stream-scoped coalesce + spinner + boot marks | `b8da0a2` |
| Sessions table + mouse | `162adab` |
| Model hub Hermes inventory | `3be9e31` |
| Live `/model --global` via slash.exec | `e0249ec` |
| org/name model id bareModelId | `cb59f5d` |
| Footer + effort coat sync | `93123af` |
| P2 ports / P1 cron-kanban-profile | prior |
| Image attachment through CockpitSession → brain → gateway | `6603ed6` |
| `restoreQueuedMessagesToEditor` abort via cockpit helper | `5557769` |
| `[Attached image: <path>]` rendered as clickable OSC 8 hyperlink | `f905dc0` |

---

## P0 — product safety (operator dogfood gate)

| # | Item | Status |
|---|------|--------|
| 0 | `/reasoning` picker + footer effort paint (3 bugs — MiniMax session death) | **shipped `f71c64b`** · **re-dogfood after relaunch** |
| 1 | Approvals + clarify ask-dialog | wired · **dogfood open** |
| 2 | Slash.exec + pager + dead-gateway | wired · **dogfood open** |
| 3 | Port CLI death banners | warning fg · **dogfood open** |
| 4 | Model hub live switch + footer label | **code shipped** · **re-dogfood after relaunch** |
| 5 | Image paste via Hermes → clickable hyperlink in user-bubble | **code shipped** · **re-dogfood after relaunch** |

Script: `docs/DOGFOOD_CHECKLIST.md` §1.

---

## P1 — coat ↔ Hermes identity residual

| Item | Status | Exit |
|------|--------|------|
| Hub inventory + live switch + org/name ids | **shipped** | — |
| Footer model / effort mirror | **shipped** | operator dogfood OK 2026-07-24 |
| Keyboard model cycle (no OMP roles) | **shipped** | Hermes catalog + `/model --global` |
| Live `config.set` hot keys (Herm lane) | **shipped** | `config-lane.ts` + ConfigPort.setGateway |
| Coat full history after resume | **shipped** | `hermes-history-paint.ts` + sessions `onResumed` paints resume messages |
| Synthetic 128k ctx on Hermes models | **shipped** | `resolveHermesContextWindow` ← `usage.context_max` into coat Model |
| Boot OMP AgentSession bloat under brain | **partial** | coat-boot thins tools/MCP/ext; **CockpitSession facade shipped**; AgentSession host remains for chrome |
| Status-line after usage | partial | revision path exists; ctx window now follows context_max |
| Brain-installed interrupt path through cockpit | **shipped** | `restoreQueuedMessagesToEditor` Esc path routes through `#abortStreamingTurn()` (5557769) |

---

## Perf residual

| Done | Next | Non-goal |
|------|------|----------|
| Stream-scoped coalesce + boot + spinner | `OMHERM_PERF=1` live receipt | lex fork, React, dual brain |

---

## P2 — bridge-to-hub (next slice)

| Item | Status |
|------|--------|
| Cron rich-field form (skills/toolsets/script multi-line — Hermes parity) | **next** |
| Kanban assign/comment + board switch + status columns | **next** |
| Hero wire extension: gateway-side image rendering | **next** (after bridge/hub shape settles) |

---

## P3 non-goals

Dual brain · Herm top tabs · markdown board as SoT · plasma OS · SQLite writers outside ports · hub Config A3 from TUI session

---

## Fresh-session lane pick

1. **omherm product** → this file + `HANDOFF_PERF_WAVE_B.md`
2. **mesh Config A3 cutover** → `~/meshina/plans/HANDOFF.md` only (leave omherm alone)
