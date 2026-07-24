# Session handoff — mtui perf wave B (+ residual product dogfood)

**Written:** 2026-07-24 ~11:40 America/Toronto (Fri, work hours)  
**Repo:** `~/meshina-tui` only · branch `main` · **do not thrash** `~/meshina` hub `plans/HANDOFF.md` (parallel model-lineup / mesh ops).  
**Role lock:** L1/L2 brain for **meshina-tui** coat + Hermes brain plug. Not hub topology.  
**Product:** `mtui` = OMP coat + HermesBrain under IM (default ON). Escape `MESHINA_TUI_OMP_BRAIN=1`. **No HMR** — quit + relaunch after coat/bridge edits.  
**Binary:** `/home/nixos/.bun/bin/mtui` → sources this repo.

---

## Parallel-session boundaries (binding)

| Lane | Owner | Touch? |
|------|--------|--------|
| `~/meshina` `stable/mesh-beta` model lineup / VITALS / Config A3 | **other session** | **NO** unless operator says |
| Hub `plans/HANDOFF.md` / kanban model epic | other | **NO** |
| `~/meshina-tui` main tip | **this session** | YES |
| `~/.hermes/` skill patches that affect all profiles | only with operator OK | careful |
| Dual brain / Herm React tab strip / plasma OS | **never** | non-goal |

If a task needs mesh model probes, stop and ask — do not SSH topology rebuild from a TUI session.

---

## Tip state (verify on boot)

```bash
date; cd ~/meshina-tui && git log -8 --oneline && git status -sb
```

Expected arc (local, may be ahead origin by ~11+):

| Commit | What |
|--------|------|
| `6b47bcd` | **perf pass B (partial):** mouse height WeakMap, splash frame LRU, slash cmd Map, ascii pad |
| `6e1f4ef` / `7c3ece7` / `a98c5da` | quick-access chips + tighter layout |
| `ff06218` / `e17ee44` | sessions picker, kanban board switch, slash pager |
| `e99cba2` (or sibling) | P2 inventory/mapper crash-harden |

**Boot probes (TUI session):**

```bash
hostname; uname -n; tailscale ip -4 2>/dev/null; pwd
cd ~/meshina-tui/packages/coding-agent && bun test test/modes/utils/component-height.test.ts test/modes/components/quick-access-bar.test.ts
cd ~/meshina-tui/packages/hermes-bridge && bun test  # expect 82+
```

Docs spine: `docs/REMAINING_WORK.md` · this file · `docs/DOGFOOD_CHECKLIST.md` · `docs/CADILLAC.md` · `docs/HERMES_BRAIN.md`.

---

## Already shipped (do not re-do)

### Product
- P2 skills/tools/memory ports + overlays + mapper notices + subagent trail + image paste marker + slash deep-links
- Kanban board switch, slash.exec pager overlay, Hermes sessions list (resume still partial)
- Quick-access: Settings · Kanban · Sessions · Model (tight chips, flush on braille)

### Perf pass A (earlier)
- 8s TTL list cache skills/tools/memory status; mutation invalidate
- Inventory hover coalesce
- Status-line `contextUsageRevision` after Hermes `refreshInfo`
- Port CLIs async (`Bun.spawn`), no spawnSync on select path

### Perf pass B landed (`6b47bcd`)
- `utils/component-height.ts` — WeakMap heights; assistant + tool note on paint
- Mouse SGR path uses `componentHeight()` (chat + bottom chrome)
- `hermes-splash-art` frame LRU (`w|h|chrome`, max 24)
- Slash `#commandByName` Map for `/cmd args` gate
- Port + inventory ASCII-fast `pad`

**Bench receipt (synthetic, node-b):**

| Probe | Result |
|-------|--------|
| mouse walk 80 chat + 12 chrome **cached** | ~2.4 µs/op |
| same **cold** (re-render) | ~259 µs/op (~100×) |
| frame cache hit | ~1.2 µs/op |
| welcome hot cache (pre-existing) | ~ns–µs |

---

## NEXT — not shipped (this session’s charter)

Ranked by **measurable gain × safety**. Stack is **pi-tui Components**, not React.

### Wave B2 — ship candidates (prefer in order)

#### B2.1 `MTUI_PERF=1` render counters (instrumentation first)
- **Why:** prove streaming / menu storms before more micro-opts.
- **Where:** thin wrapper around `TUI.requestRender` / `requestComponentRender` in coat init OR local shim in `InteractiveMode` / `hermes-brain-install` paint path.
- **Emit:** counts per 5s window: full vs component-scoped, last frame cost if available (`#lastFrameCostMs` is internal — don’t monkey-patch pi-tui internals hard; prefer host-side counters).
- **Exit:** env off = zero cost; env on = stderr or footer dim line; one page of numbers under streaming tool spam.
- **Do not:** leave counters on by default.

#### B2.2 Editor / bottom-chrome height validity
- **Why:** first click after multiline editor growth can miss-hit until re-paint notes heights; chrome containers don’t call `noteComponentHeight` today.
- **Where:** `interactive-mode.ts` `#handleMainScreenMouse`; editor container / CustomEditor `render` if override exists; or note chrome heights once per full paint via existing compose.
- **Exit:** grow editor 5 lines → click tool card still correct without wrong row; tests with fake chrome heights.
- **Risk:** stale height if noted without content change — prefer note-on-render only.

#### B2.3 Thinking-header hit rebuild (assistant-message)
- **Why:** `render()` → `super.render()` then `#rebuildThinkingHeaderHits` walks children again. L1-cheap after paint; still 2× child.render on cold/theme invalidate.
- **Where:** `assistant-message.ts` `#rebuildThinkingHeaderHits`.
- **Approach:** accumulate row offsets during a single walk, or cache hit map keyed by `(width, blockVersion)` and skip rebuild when unchanged.
- **Exit:** same click-to-toggle thinking compact; microbench cold render no worse; no double markdown lex on steady stream.

#### B2.4 Gateway / brain event coalesce
- **Why:** Hermes `message.delta` / tool.progress can still fan into coat `requestRender` if IM path doesn’t microtask-coalesce like `hermes-interactive-shell.ts`.
- **Where:** `hermes-brain-install.ts` + any direct `ui.requestRender` from bridge handlers.
- **Approach:** copy shell’s `paintScheduled + queueMicrotask` (or share `coalescePaint(tui)` util).
- **Exit:** bursty stream → ≤1 scheduled full paint per turn of the event loop (counter under `MTUI_PERF=1`).
- **Integrity:** must not drop final frame; force paint on turn_end / tool_end.

#### B2.5 Overlay dirty-rect / scoped paint audit
- **Why:** some nav still calls `#paintFull` / `requestRender()` where `#paintLocal` suffices.
- **Where:** `hermes-port-list.ts`, `hermes-inventory-list.ts`, `hermes-sessions-list.ts`, settings show/hide stack.
- **Exit:** hover/sel/nav → `requestComponentRender` only; load/reload/forms → full OK. No dual alt-screen glitches.

### Wave B3 — investigate only (likely little gain or upstream)

| Item | Verdict stance | Action if touched |
|------|----------------|-------------------|
| Markdown lex itself | pi-tui already L1 instance + L2 module LRU | **Don’t fork pi-tui** unless A/B proves coat miss; pin bump only with changelog read |
| Streaming delta path | TUI ~30fps + adaptive floor | Coalesce at **brain boundary** (B2.4), not rewrite Markdown |
| React `flushSync` / `<Activity>` | **Wrong stack** (Herm/Orca skill) | **Never** apply to mtui |
| SettingsList internals | upstream `@oh-my-pi/pi-tui` | Document friction; upstream issue or thin coat wrapper only |
| Skills `--json` list upstream | CLI shape | Ask Hermes upstream / port cache only (pass A done) |

### Product residual (not perf — schedule if operator prioritizes)

| Pri | Item | Path |
|-----|------|------|
| P0 | Approvals + clarify → ask-dialog e2e dogfood | `ask-dialog` + bridge |
| P0 | Slash.exec live gateway results | router + brain |
| P0 | Port mutations fail-loud under CLI death | port-list banners |
| P1 | Sessions **resume** SoT (list partial) | `hermes-sessions-list` + brain |
| P1 | Live `config.set` hot keys | ConfigPort |
| P1 | Status-line invalidate tick after usage | status-line + revision |

P0 dogfood still outranks perf B3. If operator says “perf only,” stay on B2.*.

---

## Suggested session plan (conductor)

1. **INTAKE (5 min):** git tip, tests green, this doc + `REMAINING_WORK.md`, role lock, no hub.
2. **B2.1 instrumentation** first if any streaming/menu work — receipts before claims.
3. **B2.2 + B2.3** surgical coat patches + unit tests.
4. **B2.4** only if counters show render storms under live Hermes stream.
5. **B2.5** grep audit `#paintFull` / bare `requestRender` in hermes-* overlays.
6. **Dogfood:** relaunch `mtui`; click tools, expand thinking, open Skills/Kanban/Sessions, type `/` args.
7. **Close-gate:** commit on approval; update this file + `REMAINING_WORK.md` stamp; **do not** edit hub HANDOFF.

### Definition of done (wave B2)
- [ ] At least one of B2.1–B2.4 shipped with before/after number or counter receipt
- [ ] No visual regression (chips, splash, overlays, thinking toggle)
- [ ] `bun test` targeted suites green; bridge suite not regressed
- [ ] Docs stamp updated; parallel-session boundary respected

### Stop / escalate
- Gateway down → skip live stream A/B; use headless counters + synthetic
- pi-tui internal private field access temptation → stop; file note, don’t break package
- Operator starts hub model work in-thread → park TUI; don’t interleave

---

## Key paths (perf)

| What | Path |
|------|------|
| Height cache | `packages/coding-agent/src/modes/utils/component-height.ts` |
| Mouse hit | `interactive-mode.ts` `#handleMainScreenMouse` |
| Assistant paint | `components/assistant-message.ts` |
| Tool paint | `components/tool-execution.ts` |
| Splash frame | `components/hermes-splash-art.ts` |
| Slash AC | `prompt-action-autocomplete.ts` |
| Shell coalesce (pattern) | `hermes-interactive-shell.ts` `paint()` |
| Brain plug | `hermes-brain-install.ts` |
| Port overlays | `hermes-port-list.ts` / inventory / sessions |
| pi-tui throttle | `node_modules/@oh-my-pi/pi-tui/src/tui.ts` (`#MIN_RENDER_INTERVAL_MS` ≈ 30fps) |

---

## Commit message seeds (when shipping)

```
perf(mtui): MTUI_PERF render counters (opt-in)
perf(mtui): note chrome heights; fix post-grow click hit
perf(mtui): cache thinking-header hit map by blockVersion
perf(mtui): coalesce Hermes brain paints (microtask)
```

---

## Operator one-liner for next session

> Fresh session: load `~/meshina-tui/docs/HANDOFF_PERF_WAVE_B.md`. Stay in meshina-tui. Parallel hub model work is off-limits. Ship wave B2 (instrument → chrome heights → thinking hits → brain coalesce → overlay scoped paint). Skip React/OpenTUI advice. Relaunch mtui after edits. Don’t touch hub HANDOFF.
