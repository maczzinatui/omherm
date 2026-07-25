# Session handoff — omherm (perf + model hub + coat identity)

**Written:** 2026-07-24 ~16:20 America/Toronto (Fri, work hours) ·
**Updated:** 2026-07-24 ~21:30 America/Toronto (Friday closeout — image wire + restoreQueuedMessagesToEditor peel)
**Repo:** `~/omherm` · branch `main` · tip **`5557769`** (pushed) +
folllow-up hero wire (in flight) + dogfood stamp doc-update (this file)
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
| `5557769` | **input-controller**: route `restoreQueuedMessagesToEditor` abort through cockpit helper (brain-installed sessions don't double-fire) |
| `6603ed6` | **hermes-bridge**: image attachment through `CockpitSession` → `brain` → `gateway` (`MessageImage` flows end-to-end) |
| `44c253b` | plan-mode Hermes transport + cockpit peel pilot |
| `738f720` | reconcile HermesConfigPort / session.steer parity table |
| `67a9c67` | `CockpitSession` facade + scrub legacy mtui product naming |
| `2e72fa0` | paint Hermes resume history + live `context_max` window |
| `3f15166` | thin OMP agent harness on Hermes coat boot |
| `d8b56c7` | Herm config lane + Hermes-only model cycle |
| `7d1d77b` | handoff stamp model hub + coat identity; parallel lane rules |
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
- **Bugfix:** `bareModelId` must only strip `<provider>/`, never org segment (`inclusionai/ling-…` stayed intact). Gateway "not found" prose = hard fail.
- **Coat identity:** `hermes-coat-identity.ts` pushes Hermes model/effort into OMP `agent.setModel` (paint-only, no OMP auth) on install, `session.info`, hub assign, turn end. Thinking cycle under Hermes → `/reasoning <effort> --global`.

### Image attachment through CockpitSession (new this slice)
- `MessageImage` type flows end-to-end: `CockpitSession.submit(text, images?)` → `brain.prompt(text, images?)` → `gateway.submit(text, images?)` → `prompt.submit` JSON-RPC with `images` param. Same for `steer`. Three new tests in `cockpit-session.test.ts` lock the contract.
- The bridge forwards `images` as opaque JSON-RPC params; the gateway is allowed to ignore unknown fields (degraded mode is the same text-only path the coat already supports on the wire). Wiring the gateway to render images is a Hermes core change, not a bridge change.

### Image via Hermes paste (new this slice — hero wire)
- `input-controller.ts:1531` already emits `[Attached image: <path>]` markers when the Hermes brain is installed (the model gets a text path hint; gateway `prompt.submit` is text-only).
- `image-references.ts` now recognizes the `[Attached image: <path>]` marker as a third placeholder kind (`attached-image`) and renders it as a clickable OSC 8 `file://` hyperlink via the new `attachedImageHyperlink` helper. Same harness as the legacy `[Image #N]` `[Paste #N]` pipeline, no new wire.
- `user-message.ts` and `custom-editor.ts` route the new kind through the same renderer; users see a clickable link in the transcript, the model sees the literal path.
- 4 new tests in `image-references.test.ts` lock the contract (classify, sort with legacy markers, reject embedded newlines, `shiftImageMarkers` preserves attached-image verbatim).

### Perf / stability (prior)
- Stream-scoped `setStreamPaintCoalesce`; spinner contract; `bootMark`; mid-stream dispose fail-loud.
- Docs: `docs/PERF_SWEEP.md`.

### Sessions / ports (prior)
- Sessions table layout + mouse; port fail-loud banners.

### Peel: brain-installed interrupt path (new this slice)
- `input-controller.ts:1408` and `:1447` (the two `if (options?.abort)` branches inside `restoreQueuedMessagesToEditor`) now route through the existing `#abortStreamingTurn()` helper — the same cockpit-first / OMP-fallback peel already used by `app.interrupt`. Esc-on-queue does not double-fire when the Hermes brain is installed.

### Slipped from prior broken-loop todo (intentional, not peels)
- `extension-ui-controller.ts:176, 407` — `abort: () => session.abort(...)` inside `ExtensionContextActions`. The API surface OMP extensions consume; the cockpit facade does not expose `abort` through that contract. Would need a `cockpit.abort()` on the facade + extension type bump to peel cleanly.
- `selector-controller.ts:1682` — `session.abortBranchSummary()` is a session-internal branch-summary mechanism, not a turn-interrupt. Does not go through Hermes.
- `print-mode.ts:189/195`, `agent-dashboard.ts:781`, `agent-transcript-viewer.ts:537` — headless / replay / transcript-viewer consumers. The Hermes brain is coat-only; these are downstream consumers that don't install the brain.

---

## Next session — start here (omherm only)

1. **Dogfood (relaunch `omh`):** model hub + footer + image hyperlink + interrupt peel all green. Verify paste-an-image flow on a Hermes turn → user-bubble renders the clickable path.
2. **P0 product dogfood** still open: approvals+clarify · slash.exec · port death banners (`docs/DOGFOOD_CHECKLIST.md`).
3. **P1 cron rich-field form** (skills/toolsets/script multi-line — Hermes parity) — bridge-to-hub work.
4. **P1 kanban assign/comment + board switch + status columns** — bridge-to-hub work.
5. **Hero wire extension:** gateway-side image rendering (the bridge already passes images through; the gateway still drops unknown fields).

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
| Image placeholders | `packages/coding-agent/src/modes/image-references.ts` |
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
  packages/coding-agent/test/modes/components/hermes-model-hub-feed.test.ts \
  packages/coding-agent/test/modes/image-references.test.ts
```

---

## Coordinate

- **This lane closed clean** on `main` (no intentional dirty tree at handoff write — re-check `git status`).
- **Mesh lane owns** node-b OCI/systemd/LiteLLM dirt under `~/meshina`. Do not steal that WIP.
- Fresh session: pick **one** lane from the boundary table before editing.
