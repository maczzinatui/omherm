# Session handoff — omherm perf wave B (+ residual product dogfood)

**Written:** 2026-07-24 ~12:45 America/Toronto (Fri, work hours)  
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

**2026-07-24 ~12:15:** tip still `9e49754` (docs) + **dirty uncommitted B2** (see Working tree below). Ahead origin ~12.

| Commit | What |
|--------|------|
| `9e49754` | docs: perf wave B handoff + remaining stamp |
| `6b47bcd` | **perf pass B (partial):** mouse height WeakMap, splash frame LRU, slash cmd Map, ascii pad |
| `6e1f4ef` / `7c3ece7` / `a98c5da` | quick-access chips + tighter layout |
| `ff06218` / `e17ee44` | sessions picker, kanban board switch, slash pager |

**Working tree (B2 — not committed; operator approval required):**

- `packages/coding-agent/src/modes/utils/perf-counters.ts` (**new**)
- `packages/coding-agent/test/modes/utils/perf-counters.test.ts` (**new**)
- `packages/coding-agent/test/modes/components/assistant-message-hit-cache.test.ts` (**new**)
- M: `interactive-mode.ts`, `assistant-message.ts`, `component-height.ts`(+test), `custom-editor.ts`
- M: this file + `docs/REMAINING_WORK.md`

**Boot probes:**

```bash
cd ~/omherm/packages/coding-agent && bun test \
  test/modes/utils/perf-counters.test.ts \
  test/modes/utils/component-height.test.ts \
  test/modes/components/assistant-message-hit-cache.test.ts
# expect all pass (coalesce + counters + height + hit cache)
cd ~/omherm/packages/hermes-bridge && bun test  # expect 86+
```

Docs spine: `docs/REMAINING_WORK.md` · this file · `docs/DOGFOOD_CHECKLIST.md` · `docs/CADILLAC.md` · `docs/HERMES_BRAIN.md`.

---

## Already shipped on tip (committed)

### Product
- P2 skills/tools/memory ports + overlays + mapper notices + subagent trail + image paste marker + slash deep-links
- Kanban board switch, slash.exec pager overlay, Hermes sessions list (resume still partial)
- Quick-access: Settings · Kanban · Sessions · Model (tight chips, flush on braille)

### Perf pass A / B (committed)
- Pass A: TTL caches, inventory hover coalesce, status-line revision, async port CLIs
- Pass B `6b47bcd`: height WeakMap + assistant/tool note; splash frame LRU; slash Map; ascii pad

---

## Wave B2 — local dirty (2026-07-24)

Minimax implemented B2.1–B2.4; Herm review follow-up closed the holes (coalesce race, wrap order, tests, editor note).

| Item | Status | Receipt |
|------|--------|---------|
| **B2.1** `MTUI_PERF=1` counters | **done (dirty)** | `perf-counters.ts`; off = no-op; on = wrap + 5s stderr; unit tests |
| **B2.2** chrome/editor height | **done (dirty)** | Container child-sum in `componentHeight`; `CustomEditor.render` notes height; height tests |
| **B2.3** thinking hit cache | **done (dirty)** | `(width, blockVersion)` gate; hit-cache tests; assistant suite green |
| **B2.4** paint coalesce | **done (dirty)** | `coalesceTuiPaint` gen-cancel on force; counters under coalesce; 5 coalesce unit tests |
| **B2.5** overlay `#paintLocal` audit | **done (dirty)** | shared `overlay-paint.ts`; soft reload local; hover coalesce port/sessions; model-hub spinner local |

### Review fixes applied on top of minimax

1. **Force + pending microtask:** generation counter; forced paint cancels stale ordinary microtask (no double paint).
2. **Wrap order:** counters on raw TUI, coalesce **outer** so `MTUI_PERF` sees paints that reach pi-tui.
3. **Dispose order:** restore coalesce first, then counters.
4. **`coalesceTuiPaint` API:** returns `{ restore, stats }` (`dropped` / `flushed` / `cancelledByForce`).
5. **CustomEditor** `noteComponentHeight` on paint (charter leaf gap).
6. Docs stamp (this file + `REMAINING_WORK.md`).

### Test receipt (Herm 2026-07-24 ~12:10 EDT)

- coding-agent targeted (perf + height + assistant*): **54 pass / 0 fail**
- hermes-bridge: **86 pass / 0 fail**
- Pre-existing (not B2): `tool-execution-spinner` **3 fail** on tip with or without B2 stash — do not block B2 commit message

### Known residual risks

- Coat coalesce is belt-and-suspenders on top of pi-tui `#renderRequested` + ~30fps throttle — still useful; don’t oversell frame savings without live `MTUI_PERF=1` stream.
- Live dogfood (multiline editor click, thinking toggle, overlays) still operator / next session after relaunch `omherm`.
- B2.5 still open.

### Definition of done (wave B2)

- [x] B2.1–B2.5 implemented + unit receipts
- [ ] Operator dogfood visual pass
- [x] Targeted + bridge green (spinner tip debt separate)
- [x] Docs stamp; hub HANDOFF untouched
- [ ] **Commit on operator approval only**

---

## NEXT

1. Operator dogfood: relaunch `omherm`; multiline editor → tool click; thinking collapse; Skills/Kanban/Sessions/Model; optional `MTUI_PERF=1` stream.
2. Commit when approved (seed below) — B2.1–B2.5 dirty.
3. Product P0 residual (approvals/clarify, slash.exec live, port fail-loud) if operator reprioritizes off perf.
4. **Upstream note:** pi-tui `#resolvePartialComposeRoots` returns null when `overlayStack.length > 0` — coat scoped API is correct but compose stays full until upstream overlay-local frames.

### Commit message seed

```
perf(omherm): B2 counters, height sum, thinking hit cache, paint coalesce, overlay paint

- MTUI_PERF=1 request counters (opt-in)
- componentHeight Container child-sum + CustomEditor note
- thinking-header hit map cache by (width, blockVersion)
- coalesceTuiPaint microtask + force cancels pending; counters under coalesce
- B2.5 overlay-paint helper; soft reload local; hover coalesce; model-hub scoped paints
```

---

## Key paths (perf)

| What | Path |
|------|------|
| Height cache | `packages/coding-agent/src/modes/utils/component-height.ts` |
| Perf + coalesce | `packages/coding-agent/src/modes/utils/perf-counters.ts` |
| Mouse hit | `interactive-mode.ts` `#handleMainScreenMouse` |
| Assistant paint | `components/assistant-message.ts` |
| Editor note | `components/custom-editor.ts` |
| Tool paint | `components/tool-execution.ts` |
| Shell coalesce (pattern) | `hermes-interactive-shell.ts` `paint()` |
| Port overlays | `hermes-port-list.ts` / inventory / sessions |
| pi-tui throttle | `node_modules/@oh-my-pi/pi-tui/src/tui.ts` |

---

## Operator one-liner for next session

> Fresh session: load `~/omherm/docs/HANDOFF_PERF_WAVE_B.md`. Stay in omherm. B2.1–B2.5 dirty local — dogfood then commit on approval. Skip React/OpenTUI. Don’t touch hub HANDOFF.
