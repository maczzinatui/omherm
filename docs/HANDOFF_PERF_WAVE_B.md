# Session handoff — omherm (perf + model hub + coat identity)

**Written:** 2026-07-24 ~16:20 America/Toronto (Fri, work hours)  
**Repo:** `~/omherm` · branch `main` · tip **`196c954`** (pushed)  
**Role lock:** L1/L2 brain for **omherm coat + Hermes brain plug only**.  
**Product:** Hermes brain · OMP InteractiveMode coat · launch `omh` / `omherm` (`MESHINA_TUI_BRAND=hermes`). Escape `MESHINA_TUI_OMP_BRAIN=1`. **No HMR** — quit + relaunch after coat/bridge edits.  
**Binary:** `/home/nixos/.bun/bin/omherm`

---

## Parallel-session boundaries (binding — read first)

| Lane | Owner | Touch? |
|------|--------|--------|
| `~/meshina` `stable/mesh-beta` · Config A3 / Laguna+KAT OCI cutover · VITALS · LiteLLM routes | **mesh/infra session** | **NO** from TUI lane unless operator pins this session |
| Hub `plans/HANDOFF.md` Config A3 next steps (T4–T8 etc.) | mesh session | **Do not replace.** Pointer-only edits OK |
| `~/meshina` dirty tree (Dockerfile.laguna, cutover scripts, compose, slot units) | mesh session inflight | **NO** — leave for that lane |
| `~/omherm` main | **this product lane** | YES |
| Dual brain / Herm React strip / plasma OS / hub model-lineup thrash | **never** | non-goal |

**Boot orientation for a fresh session:**

```bash
date; hostname; cd ~/omherm && git log -5 --oneline && git status -sb
# Mesh lane (read-only glance if coordinating):
cd ~/meshina && git status -sb | head -20 && head -30 plans/HANDOFF.md
```

If the task is mesh cutover / LiteLLM / systemd slots → use **meshina HANDOFF next steps**, not this file.

---

## Tip lineage (omherm `main`, verify with `git log`)

| Commit | What |
|--------|------|
| `196c954` | test path fix coat-identity |
| `93123af` | **footer model + effort sync** with live Hermes identity |
| `cb59f5d` | keep `org/name:tag` model ids (bareModelId fix) |
| `e0249ec` | hub assign → gateway `/model … --global` |
| `3be9e31` | Model hub Hermes inventory (Nous Portal chrome) |
| `b8da0a2` | stream-scoped paint coalesce + spinner + boot marks |
| `162adab` | sessions mouse/layout + port fail-loud banners |
| `b2b98b0` | B2 perf + sticky chrome + tips checkpoint |

---

## Closed this arc (do not re-do)

### Model hub + live switch
- Hub UI = OMP chrome + **Hermes catalog** (`loadHermesModelCatalog` → `scopedModels`).
- Default assign: `applyHermesModelLive` → `slash.exec` `/model <id> --provider <p> --global` (agent switch + config). Config-only is insufficient for running session.
- **Bugfix:** `bareModelId` must only strip `<provider>/`, never org segment (`inclusionai/ling-…` stayed intact). Gateway “not found” prose = hard fail.
- **Coat identity:** `hermes-coat-identity.ts` pushes Hermes model/effort into OMP `agent.setModel` (paint-only, no OMP auth) on install, `session.info`, hub assign, turn end. Thinking cycle under Hermes → `/reasoning <effort> --global`.

### Perf / stability (prior)
- Stream-scoped `setStreamPaintCoalesce`; spinner contract; `bootMark`; mid-stream dispose fail-loud.
- Docs: `docs/PERF_SWEEP.md`.

### Sessions / ports (prior)
- Sessions table layout + mouse; port fail-loud banners.

---

## Next session — start here (omherm only)

1. **Dogfood (relaunch `omh`):** model hub + footer already green (operator 2026-07-24).
2. **New this slice — lobotomy:**
   - Keyboard **model cycle** (prev/next) under Hermes brain walks Hermes inventory + live `/model --global` — **not** OMP role registry. Status: `Hermes model → …`
   - **Herm config lane** ported (`packages/hermes-bridge/src/config-lane.ts` from `~/herm/src/config/lane.ts`): hot keys → gateway `config.set` RPC aliases; cold → CLI. Brain install attaches `hermesConfigPort().setGateway(brain.gateway)`.
   - **Coat boot thin** (`hermes-coat-boot.ts`): interactive Hermes → empty OMP tools + `restrictToolNames`, MCP/LSP/extensions off, skip OMP modelRegistry refresh. Escape `MESHINA_TUI_OMP_BRAIN=1`.
3. **P0 product dogfood** still open: approvals+clarify · slash.exec · port death banners (`docs/DOGFOOD_CHECKLIST.md`).
4. **Shipped this slice (history + ctx):**
   - Coat history after Hermes resume — `hermes-history-paint.ts`; sessions list passes full `messages`; paint via `addMessageToChat` (user + custom assistant/tool lines).
   - Context window — drop blind 128k when `session.info.usage.context_max` present (`resolveHermesContextWindow` → synthetic Model).
5. **Named debt still open:**
   - AgentSession host still constructed (chrome/`!bash`) — CockpitSession facade later
   - Voice STT/TTS settings multiselect
   - pi-tui overlay full-compose residual
   - Gateway may still omit history on some resume paths → notice + preview fallback

### Herm fork reference (binding research gold @ `3d2170a`)

Steal methods, not React tabs:

| Herm path | omherm status |
|-----------|----------------|
| `src/config/lane.ts` RPC_ALIAS + writeConfig | **ported** → `hermes-bridge/config-lane.ts` |
| `src/config/models.ts` config.set model | live `/model` + catalog (prior) |
| `session.steer` | brain.steer (prior) |
| `session.list` / resume + `transcriptToMessages` | **resume paint** via `hermes-history-paint.ts` |
| Schema-driven settings IA | product filter + ConfigPort; live apply now RPC when gw attached |

---

## Key paths

| What | Where |
|------|--------|
| Catalog + live switch | `packages/hermes-bridge/src/hermes-model-catalog.ts` |
| Brain + identity listeners | `packages/hermes-bridge/src/hermes-brain.ts` |
| Coat paint sync | `packages/coding-agent/src/modes/hermes-coat-identity.ts` |
| History resume paint | `packages/coding-agent/src/modes/hermes-history-paint.ts` |
| Brain install | `packages/coding-agent/src/modes/hermes-brain-install.ts` |
| Hub wire | `selector-controller.ts` · `hermes-model-picker.ts` |
| Thinking cycle | `input-controller.ts` → `cycleHermesThinking` |
| Bar | `docs/CADILLAC.md` · `docs/HERMES_BRAIN.md` |
| Backlog | `docs/REMAINING_WORK.md` |
| Mesh parallel brief | `~/meshina/plans/HANDOFF.md` (Config A3 — **other lane**) |

---

## Tests (smoke)

```bash
cd ~/omherm && bun test \
  packages/hermes-bridge/src/hermes-model-catalog.test.ts \
  packages/hermes-bridge/src/hermes-brain.test.ts \
  packages/coding-agent/test/modes/hermes-coat-identity.test.ts \
  packages/coding-agent/test/modes/components/hermes-model-hub-feed.test.ts
```

---

## Coordinate

- **This lane closed clean** on `main` (no intentional dirty tree at handoff write — re-check `git status`).
- **Mesh lane owns** node-b OCI/systemd/LiteLLM dirt under `~/meshina`. Do not steal that WIP.
- Fresh session: pick **one** lane from the boundary table before editing.
