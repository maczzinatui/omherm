# Settings remap — OMP coat schema → Hermes native (binding)

**Stamp:** 2026-07-23 · **Cadillac:** `CADILLAC.md`  
**Problem:** `packages/coding-agent` ships **~428** OMP/pi-agent settings across 10 tabs. After gut, **the brain is Hermes**. Leaving that panel as-is is a lie: operators toggle keys that no longer drive the agent.

**Rule:** Every settings row is one of:

| Class | Meaning |
|-------|---------|
| **COAT** | Pure TUI chrome. Lives in mtui/OMP local store. Never claims to configure Hermes. |
| **HERMES** | Backed by Hermes public surface (`config.get`/`config.set`, CLI, gateway RPC). Label + path must match Hermes. |
| **PORT** | Hermes feature via a port panel (Kanban, Cron, Profiles) — not a boolean in OMP schema. |
| **PURGE** | OMP/pi-only. Hidden or deleted on mtui product path. Tests fail if it reappears as “live.” |
| **BRIDGE** | Temporary dual-read while brain still OMP AgentSession; must flip to HERMES or PURGE at brain cutover. |

**Product path** = default `mtui` InteractiveMode. Experimental bridge and stock `omp` binary may keep raw OMP schema.

---

## North star IA (settings hub)

Replace OMP’s mental model with Hermes + coat:

| Tab (target) | Owns |
|--------------|------|
| **Appearance** | Theme, splash, status line, streaming chrome, OSC title brand |
| **Session** | Model/provider (Hermes), reasoning effort, personality/display, max turns, steer/interrupt |
| **Approvals** | Hermes `approvals.*` + deny pack (not OMP `tools.approvalMode` alone) |
| **Context** | Hermes compression / LCM / context % (not OMP snapcompact-as-brain) |
| **Memory** | Hermes memory limits, USER/MEMORY paths, notifications — **not** mnemopi/hindsight as default |
| **Tools** | Hermes toolsets enable/disable, terminal, browser, MCP as Hermes sees them |
| **Voice** | Hermes STT/TTS (mesh + cloud) |
| **Delegation** | Hermes `delegation.*` mesh pins |
| **Kanban** | `KanbanPort` panel |
| **Cron** | `CronPort` panel |
| **Profiles** | `ProfilePort` panel |
| **Providers / Platforms** | Hermes providers, platform_toolsets, messaging — secrets via path/env not dump |
| **Advanced / Diagnostic** | Timeouts, logging, doctor links — clearly “Hermes” |

Drop or demote OMP-only: Fireworks tiers, Codex resets, collab relay, TTSR-as-product, OMP task isolation worktrees as agent brain, Exa-as-OMP-provider stack when Hermes owns search.

---

## Classification by current OMP tab

Inventory source: `settings-schema.ts` (**428** keys, 10 tabs). Counts below are UI-exposed keys with `ui.tab`.

### 1. Appearance (28) — mostly **COAT**

| Group | Verdict | Notes |
|-------|---------|--------|
| Theme | **COAT** | Keep. Hermes skins optional later (`hermes skin` / display) — coat theme is primary paint. |
| Status Line | **COAT** + **HERMES bind** | Layout COAT; token/context/% segments must bind **gateway usage**, not OMP local counters (`INTEGRATION_CROSSOVERS`). Rename “pi” segment → hermes. |
| Display | **COAT** | streaming, tight, hyperlinks, shimmer — keep. |
| Images | **COAT** / partial HERMES | Terminal image paint COAT; vision path follows Hermes tools when brain is Hermes. |

**Purge/rename:** any label saying “Pi” / OMP product; `task.showResolvedModelBadge` → session model from Hermes.

### 2. Model (40) — **HERMES rewrite**, heavy purge

| Group | Verdict | Hermes target |
|-------|---------|----------------|
| Thinking | **HERMES** | `display.show_reasoning`, `model.reasoning_effort`, `reasoning_overrides` — not OMP `defaultThinkingLevel` as SoT |
| Sampling | **PURGE** (mostly) | temp/topP/etc. are OMP provider sampling. Hermes sampling is model/server side. Keep only if gateway exposes overrides. |
| Prompt | **MIX** | personality → Hermes display/personality if exists; `includeWorkspaceTree` may be OMP prompt — **PURGE** or map to Hermes context files |
| Retry & Fallback | **HERMES** | Hermes fallback / moa / provider chain — not OMP `retry.fallbackChains` as written |
| Advisor | **HERMES** or PURGE | Mesh advisor = config auxiliary / panel — not OMP advisor.subagents |
| Prewalk | **PURGE** | OMP prewalk product feature |
| Vision | **HERMES** | Hermes vision / image tools |

**Cutover:** Model tab becomes Hermes model picker (`config` model.default/provider/base_url/context_length) + effort + show_reasoning. OMP role storage **PURGE**.

### 3. Interaction (40) — split hard

| Group | Verdict | Hermes target |
|-------|---------|----------------|
| Input | **COAT** + HERMES | steer/interrupt/follow-up → `session.interrupt` / steer RPC; tree filter COAT |
| Approvals | **HERMES** | `approvals.mode`, `approvals.timeout`, `approvals.cron_mode`, `approvals.deny` |
| Notifications | **COAT** + HERMES | completion bell may map Hermes display.bell; recap OMP-specific → purge or reimplement |
| Speech STT | **HERMES** | `stt.*` |
| Collab | **PURGE** | OMP collab relay / share server — not mesh product |
| Magic Keywords | **PURGE** or COAT-only | OMP ultrathink/orchestrate — do not pretend Hermes slash |
| Startup & Updates | **COAT** | splash, quiet, **checkUpdate OFF/purged on mtui** (already suppressed nag) |
| Power macOS | **COAT** optional | keep if harmless |
| Agent unexpected stop | **PURGE** | OMP |
| Git enabled | **COAT** or HERMES terminal | weak — git is tool side |

### 4. Context (27) — **HERMES compression**, purge OMP compact stack

| Group | Verdict | Hermes target |
|-------|---------|----------------|
| General | **MIX** | additional dirs → Hermes terminal cwd / project; branch summary OMP → purge |
| Compaction | **HERMES** | Hermes context compression block (threshold, target ratio, protect messages, compression model) |
| Rules TTSR | **PURGE** | OMP TTSR product |
| Snapcompact experimental | **PURGE** | never drive Hermes history |

### 5. Memory (30) — **HERGE OMP backends**, Hermes memory

| Group | Verdict |
|-------|---------|
| General memory.backend OMP | **PURGE** as agent SoT |
| Mnemopi (17) | **PURGE** on product path (OMP memory plugin) |
| Hindsight (9) | **PURGE** on product path |
| Replacement | **HERMES** `memory.*` (enabled, char limits, USER/MEMORY), optional Mnemosyne/LCM if Hermes-native — label honestly |

### 6. Files (23) — **PURGE as agent tools**, optional COAT

Hermes owns read/edit tools. OMP `edit.*` / `read.*` / `lsp.*` do **not** configure Hermes tools.

| Verdict | Action |
|---------|--------|
| **PURGE** from product settings | entire Files tab as agent config |
| Optional later | “Editor assist” COAT if we add local LSP for human — not agent loop |

### 7. Shell (16) — **HERMES terminal**

| Group | Verdict | Hermes |
|-------|---------|--------|
| Bash enable/patterns | **HERMES** | `terminal.*` backend, timeout, cwd, docker caps |
| Eval py/js/rb | **HERMES** or PURGE | Hermes code_exec / toolsets — map or drop |
| direnv / minimizer | **PURGE** unless Hermes grows it |

### 8. Tools (47) — **HERMES toolsets**, purge OMP tool flags

| Group | Verdict |
|-------|---------|
| Available Tools (todo/glob/grep/browser/…) | **PURGE** OMP toggles; replace with Hermes **toolsets** list + platform_toolsets |
| Todos OMP | **PURGE** or map Hermes todo if any |
| Grep/Browser OMP | Browser → Hermes `browser.*`; grep is Hermes tool |
| GitHub OMP cache | **PURGE** / Hermes skills |
| Output limits | **HERMES** if tool output caps exist; else PURGE |
| MCP | **HERMES** MCP config (not only OMP mcp.json) |
| dev.autoqa | **PURGE** |

### 9. Tasks (26) — **PURGE OMP task engine**, partial Hermes

| Group | Verdict |
|-------|---------|
| plan/goal OMP | Goal → Hermes `/goal` + goal-plan — not OMP goal.enabled |
| Subagents OMP task.* | **PURGE**; replacement **Delegation** tab → `delegation.*` |
| Isolation worktree OMP | **PURGE** as agent; Orca worktrees are exterior |
| Skills/commands Claude/opencode | **PURGE**; Hermes skills live under `~/.hermes/skills` |

### 10. Providers (36) — **HERMES providers** rewrite

| Group | Verdict |
|-------|---------|
| webSearchOrder / searxng / exa | **HERMES** search backends (mesh SearXNG, etc.) |
| TTS/STT provider pickers | **HERMES** `tts` / `stt` |
| Fireworks / Codex resets / tiny model / antigravity | **PURGE** |
| Timeouts stream | **HERMES** or COAT client timeouts for gateway |
| secrets.enabled OMP | **PURGE**; secrets = Hermes `.env` |

### Plugins tab (OMP)

**BRIDGE → HERMES/PURGE:** OMP plugin marketplace is not Hermes plugins. Product: Hermes `plugins` / bundles or hide.

---

## Hermes native surfaces (write path)

Prefer in order (same as other ports):

1. Gateway `config.get` / `config.set` (and `key: "full"` like Herm Config tab)  
2. `hermes config get|set|unset`  
3. Never edit `config.yaml` with ad-hoc FS writes from random UI code  
4. Secrets: open path / `hermes config env-path` — do not render secret values  

Herm Config tab research: `~/herm/src/tabs/Config.tsx` + `src/config/*` field builders — **steal field registry + effect glyphs (live/restart), not React.**

Known Hermes top-level areas (from live `config.yaml` / `hermes config show`):  
`model`, `toolsets`, `terminal`, `browser`, compression/context, `auxiliary`, `display`, `tts`, `stt`, `memory`, `delegation`, `approvals`, `cron`, `tools`, `platform_toolsets`, `model_catalog`, messaging platforms, timezone, …

Exact key list: generate from `config.get full` in contract tests — do not hardcode 428 OMP names.

---

## Implementation architecture

```
settings-schema.ts          OMP upstream (vendor) — do not delete wholesale for omp binary
settings-product-manifest.ts   NEW — mtui allowlist + class + hermesKey + coatKey
settings-selector.ts        Filter by manifest on product path (mtui)
HermesConfigPort            get/set/subscribe effect (restart vs live)
coat-settings store         theme, splash, keybinds, statusline layout only
```

### Product filter (mandatory)

```ts
// pseudo
if (isMtuiProduct) {
  visible = SETTINGS_SCHEMA filtered where manifest[path].class in (COAT, HERMES)
  // PORT tabs injected as custom panels (not schema rows)
  onChange HERMES → HermesConfigPort.set
  onChange COAT → local coat store
}
```

Stock `omp` binary: unchanged schema (vendor path).

### Effect model

Steal Herm: each Hermes field `effect: "live" | "restart" | "session"`.  
Restart → confirm + gateway restart instructions (or RPC if exists). Never silent.

---

## Phased delivery

### P2 — Tools / Terminal / Voice / Delegation / slash+skills — **PARTIAL (2026-07-23)**

1. [x] Hermes model picker (OMP ModelBrowser chrome, Hermes inventory, no role hub)  
2. [x] Slash autocomplete: Hermes builtins + `~/.hermes/skills`  
3. [x] ConfigPort: terminal, memory, delegation keys  
4. [ ] Slash **execution** via gateway `command.dispatch` / session (still OMP-handled for most)  
5. [ ] Voice STT/TTS settings + toolsets multiselect  
6. [ ] Session-scoped model switch via gateway `config.set model` when brain is Hermes  

### P1 — Hermes ConfigPort + Session/Approvals/Model — **LANDED (2026-07-23)**

1. Land this doc + machine-readable `settings-product-manifest` stub (tabs + group-level classes).  
2. On mtui: **banner** in settings: product filter active.  
3. Hide entire tabs that are pure lies: **Files**, OMP **Memory** backends, etc.  
4. Do **not** write OMP settings into Hermes without key map.

### P2 — Tools / Terminal / Voice / Delegation

Map toolsets, terminal, browser, stt/tts, delegation.

### P3 — Port panels

Kanban, Cron, Profiles (already designed) as settings categories.

### P4 — Coat-only Appearance polish + purge CI

1. CI test: every visible mtui setting has manifest class ≠ missing.  
2. Fail if PURGE key is writable on product path.  
3. Drop dead OMP code paths from product bundle only when safe (tree-shake later).

---

## Test strategy (purge is not vibes)

| Test | Asserts |
|------|---------|
| `settings-manifest-coverage` | Every SETTING_TABS group classified |
| `settings-product-visible` | Snapshot of visible paths on mtui — no mnemopi, no hindsight, no collab.relay, no task.isolation |
| `hermes-config-roundtrip` | Safe keys via port |
| `coat-settings-isolated` | Theme change does not call config.set |
| `no-omp-brain-settings-write` | Changing purged key is no-op or hidden |

Dogfood: open settings on mtui, flip a HERMES key, `hermes config get` confirms; flip theme, config unchanged.

---

## Explicit purge candidates (first cut)

Do not show as live agent config on mtui:

- `mnemopi.*`, `hindsight.*`, `memory.backend` (OMP)  
- `collab.*`, `share.*`  
- `ttsr.*`, `snapcompact.*`  
- `prewalk.*`, `advisor.*` (OMP shapes)  
- `task.*` isolation/concurrency OMP engine  
- `commands.enableClaude*`, `commands.enableOpencode*`  
- `providers.fireworks*`, `codexResets.*`, `providers.tinyModel*`  
- OMP per-tool `*.enabled` toggles (glob/grep/ast…)  
- `edit.*`, `read.*`, `lsp.*` as agent tools  
- Magic keywords ultrathink/orchestrate/workflow as Hermes  
- Marketplace auto-update as OMP product update  

---

## What we refuse

- Silent dual-write OMP settings.json + Hermes config  
- Keeping 428 keys “for familiarity”  
- Mapping by English label similarity without key proof  
- Settings UI that edits AgentSession while gateway is the brain  

---

## Next concrete PR

1. `docs/SETTINGS_REMAP.md` (this file) — done.  
2. `packages/hermes-bridge` or coding-agent: `settings-product-manifest.ts` group-level classification + unit test snapshot.  
3. `SettingsSelectorComponent` product filter + banner.  
4. `HermesConfigPort` scaffold (get full / set path).

Operator sign-off on tab IA (north star table) before mass key-level mapping.
