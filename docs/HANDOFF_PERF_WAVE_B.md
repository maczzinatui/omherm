# Session handoff — omherm perf wave B (+ residual product dogfood)

**Written:** 2026-07-24 America/Toronto (Fri, work hours)  
**Repo:** `~/omherm` only · branch `main` · **do not thrash** `~/meshina` hub `plans/HANDOFF.md` (parallel model-lineup / mesh ops).  
**Role lock:** L1/L2 brain for **omherm** coat + Hermes brain plug. Not hub topology.  
**Product:** `omherm` = OMP coat + HermesBrain under IM (default ON). Escape `MESHINA_TUI_OMP_BRAIN=1`. **No HMR** — quit + relaunch after coat/bridge edits.  
**Binary:** `/home/nixos/.bun/bin/omherm` → sources this repo.

---

## Parallel-session boundaries (binding)

| Lane | Owner | Touch? |
|------|--------|--------|
| `~/meshina` `stable/mesh-beta` model lineup / VITALS / Config A3 | **other session** | **NO** unless operator says |
| Hub `plans/HANDOFF.md` / kanban model epic | other | **NO** |
| `~/omherm` main tip | **this session** | YES |
| `~/.hermes/` skill patches that affect all profiles | only with operator OK | careful |
| Dual brain / Herm React tab strip / plasma OS | **never** | non-goal |

If a task needs mesh model probes, stop and ask — do not SSH topology rebuild from a TUI session.

---

## Tip state (verify on boot)

```bash
date; cd ~/omherm && git log -8 --oneline && git status -sb
```

**Landed this session (verify `git log`):**

1. Sessions mouse/layout + port fail-loud banners (baseline)  
2. **Perf sweep:** stream-scoped `setStreamPaintCoalesce` · spinner contract fix · `bootMark` timeline · HermesBrain mid-stream dispose fail-loud · `docs/PERF_SWEEP.md`

| Area | Detail |
|------|--------|
| Stream coalesce | Arm on `agent_start`, release on `agent_end`. Idle = stock TUI. Env `OMHERM_PAINT_COALESCE` / `MTUI_PERF` still always-on. |
| Spinner | No default `|| true`; custom renderResult-only tools don't inherit generic animated pending |
| Boot | Marks: hermes bootstrap start/done, tui_constructed, tui_first_frame (`MTUI_PERF=1` → stderr) |
| Stability | `dispose()` while streaming → notice + mapper `forceEnd` before kill |

**Boot probes:**

```bash
cd ~/omherm/packages/coding-agent && bun test \
  test/modes/utils/perf-counters.test.ts \
  test/modes/components/tool-execution-spinner.test.ts \
  test/modes/components/hermes-sessions-list.test.ts
cd ~/omherm/packages/hermes-bridge && bun test src/hermes-brain.test.ts
# Measure live: MTUI_PERF=1 omh   → see docs/PERF_SWEEP.md
```

Docs spine: `docs/REMAINING_WORK.md` · this file · `docs/PERF_SWEEP.md` · `docs/DOGFOOD_CHECKLIST.md` · `docs/CADILLAC.md` · `docs/HERMES_BRAIN.md`.

---

## Already shipped (prior tip)

### Product
- P2 skills/tools/memory ports + overlays + mapper notices + subagent trail + image paste marker + slash deep-links
- Kanban board switch, slash.exec pager overlay, Hermes sessions list (coat full history replay still partial)
- Quick-access: Settings · Kanban · Sessions · Model
- **Sticky top chips** + **chat history browser**
- Hermes startup tip pack · launchers `omh` / `mtui` / `omherm` with `MESHINA_TUI_BRAND=hermes`

### Perf
- Pass A/B/B2 counters + opt-in coalesce  
- **Plus stream-scoped coalesce** (this session)

---

## P0 wiring status (code — still needs operator dogfood)

| Item | Code | Dogfood |
|------|------|---------|
| Approvals + clarify ask-dialog | wired | open |
| Slash.exec + dead-gateway | wired | open |
| Port CLI death banners | warning fg | open |

---

## Named debt (do not “fix” by inventing a second store)

- Coat full history replay after Hermes resume (notice-only OK until product decision)  
- pi-tui overlay full-compose while stack open  
- Live `config.set` hot keys via ConfigPort only  

---

## Next operator moves

1. Quit + relaunch `omh` / `omherm` (no HMR).  
2. Dogfood P0 checklist.  
3. Optional: `MTUI_PERF=1 omh` during a long stream — save stderr receipts against `docs/PERF_SWEEP.md`.  
4. Do **not** touch hub meshina HANDOFF from this lane.
