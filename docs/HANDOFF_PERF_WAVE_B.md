# Session handoff — omherm perf wave B (+ residual product dogfood)

**Written:** 2026-07-24 ~14:50 America/Toronto (Fri, work hours)  
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

**2026-07-24 ~14:43:** tip **`b2b98b0`** on `origin/main` (pushed). Clean tree after that commit.  
**This session (post-boot):** small dirty on `hermes-port-list.ts` — error banners use warning fg (P0 fail-loud polish). Commit when green.

| Commit | What |
|--------|------|
| `b2b98b0` | **checkpoint:** B2 perf + sticky chrome QoL + Hermes tips + omherm rename stamps |
| `9e49754` | docs: perf wave B handoff + remaining stamp |
| `6b47bcd` | perf pass B (partial): mouse height WeakMap, splash frame LRU, slash cmd Map, ascii pad |
| `6e1f4ef` / `7c3ece7` / `a98c5da` | quick-access chips + tighter layout |
| `ff06218` / `e17ee44` | sessions picker, kanban board switch, slash pager |

**Boot probes:**

```bash
cd ~/omherm/packages/coding-agent && bun test \
  test/modes/utils/perf-counters.test.ts \
  test/modes/utils/component-height.test.ts \
  test/modes/components/assistant-message-hit-cache.test.ts \
  test/modes/components/chat-scroll-overlay.test.ts \
  test/modes/utils/overlay-paint.test.ts
# expect all pass
cd ~/omherm/packages/hermes-bridge && bun test  # expect 86+
```

Docs spine: `docs/REMAINING_WORK.md` · this file · `docs/DOGFOOD_CHECKLIST.md` · `docs/CADILLAC.md` · `docs/HERMES_BRAIN.md`.

---

## Already shipped on tip (`b2b98b0`)

### Product
- P2 skills/tools/memory ports + overlays + mapper notices + subagent trail + image paste marker + slash deep-links
- Kanban board switch, slash.exec pager overlay, Hermes sessions list (coat full history replay still partial)
- Quick-access: Settings · Kanban · Sessions · Model
- **Sticky top chips** (content-width `statusLineBg`, footer segment colors, `ownsOverlayFocusTarget`)
- **Chat history browser** (`chat-scroll-overlay`: wheel / PgUp / PgDn, content-width chrome)
- Hermes startup tip pack · launchers `omh` / `mtui` / `omherm` with `MESHINA_TUI_BRAND=hermes`

### Perf A / B / B2
- Pass A: TTL caches, inventory hover coalesce, status-line revision, async port CLIs
- Pass B: height WeakMap + assistant/tool note; splash frame LRU; slash Map; ascii pad
- **B2.1–B2.5:** counters (opt-in `MTUI_PERF=1`); Container child-sum + CustomEditor note; thinking hit cache; `coalesceTuiPaint` opt-in; overlay-paint helpers

Coalesce/counters default **OFF** — enable with `MTUI_PERF=1` / `OMHERM_PERF=1` / `OMHERM_PAINT_COALESCE=1`.

---

## P0 wiring status (code — still needs operator dogfood)

| Item | Code | Dogfood |
|------|------|---------|
| Approvals + clarify → ask-dialog | **wired** (`#attachHermesDialogHost` → `showAskDialog`) | operator e2e |
| Slash.exec live + pager + fail warning | **wired** (`#tryHermesSlash` + text overlay) | operator e2e |
| Port mutation fail-loud | **wired** (throws → banner); **this session** warning fg on errors | dogfood CLI death |

Sessions resume SoT: gateway resume + notice + preview pager; **coat chat chrome full replay still named debt**.

---

## NEXT

1. **Operator dogfood** (relaunch `omh` after pull): sticky chips, wheel/Pg scroll, approvals/clarify, `/help` or `/yolo` slash.exec, port CLI death banners. Checklist: `docs/DOGFOOD_CHECKLIST.md`.
2. Commit port-list fail-loud color polish if still dirty.
3. P1: coat history replay after resume (or accept notice-only forever).
4. Optional: live `MTUI_PERF=1` stream receipt.
5. Tip debt (not B2): 3× `tool-execution-spinner` fails on main — separate fix.

### Non-goals

Dual brain · Herm React tab strip · markdown lex fork · hub model-lineup · plasma OS

---

## Key paths

| What | Path |
|------|------|
| Height cache | `packages/coding-agent/src/modes/utils/component-height.ts` |
| Perf + coalesce | `packages/coding-agent/src/modes/utils/perf-counters.ts` |
| Overlay paint | `packages/coding-agent/src/modes/utils/overlay-paint.ts` |
| Sticky chips | `packages/coding-agent/src/modes/components/quick-access-bar.ts` |
| Chat scroll | `packages/coding-agent/src/modes/components/chat-scroll-overlay.ts` |
| Port banners | `packages/coding-agent/src/modes/components/hermes-port-list.ts` |
| Dialog host | `interactive-mode.ts` `#attachHermesDialogHost` |
| Slash.exec | `input-controller.ts` `#tryHermesSlash` |

---

## Operator one-liner for next session

> Fresh session: `~/omherm` tip `b2b98b0` (+ any fail-loud polish). Dogfood P0 checklist. Skip hub HANDOFF. Relaunch after coat edits.
