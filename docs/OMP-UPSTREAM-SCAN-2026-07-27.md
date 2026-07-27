# OMP upstream scan → omherm (2026-07-27)

**Pin:** `.omp-upstream-sha` = `c64e7146e` (`refactor(coding-agent): consolidated jujutsu…`)  
**Upstream tip:** `can1357/oh-my-pi` `origin/main` @ `2f63a07ba` (**v17.1.6**)  
**Lag:** ~**734** commits since pin (~`v17.0.9-460` → `v17.1.6`)  
**CADILLAC:** coat only — InteractiveMode / pi-tui / settings chrome. Hermes owns the agent loop. **No bulk vendor bump** without a re-apply plan for hermes-bridge patches.

## Product filter

| Upstream area | Pull into omherm? |
|---------------|-------------------|
| `packages/tui` paint, scrollback, keybinds, PTY teardown | **Maybe** — surgical cherry / path copy |
| `coding-agent` InteractiveMode chrome only | **Maybe** if file still maps 1:1 |
| Agent loop, tools, MCP harness, memories, catalog discovery | **No** — gut is Hermes; dual brain = fail |
| Advisor cost in status line, plan-mode, live voice | **No** unless coat already shows those surfaces |
| Natives / bazel / Windows / CI perf | **No** unless build break |
| Full tip merge | **No** — 449 coding-agent commits; pride test #3 fails |

## Clear-win shortlist (if we ever bump)

Sorted by coat usefulness vs re-apply risk:

| PR / topic | Why maybe | Risk |
|------------|-----------|------|
| **#6768** defer large command panels during streaming (scrollback dupes) | Real TUI pain under stream | Medium — InteractiveMode may diverge |
| **#6788** / guarded teardown when PTY already gone | Crash on disconnect | Low–med |
| **#6784** word-delete via keybindings registry | Editor UX | Med (keybind map drift) |
| **#6748** perf launch: isolate PTY replay in broker | Launch jank | Med |
| Terminal title dedupe / FFI (`5e139d951`) | Title thrash | Low if we still set titles |
| Multiplexer raw-backspace exclusion | Remote/tmux | Low |
| Lazy schema / catalog materialize perf PR block (#6742–#6749) | Startup cost | **High** — catalog is still stock-shaped; we may not need |

## Explicit non-pulls

- SiliconFlow / catalog discovery epics — coat can keep pin’s catalog regen; mesh models via Hermes/LiteLLM.  
- Task effort ceilings, MCP resource URI, memories structure — **Hermes / not coat**.  
- Pre-model-call gate (#6543) — agent loop, not omherm.  
- Advisor status-line cost — dual-runtime chrome; product path is Hermes gateway events.

## Recommended posture (now)

1. **Do not** bump `.omp-upstream-sha` this session.  
2. If operator dogfoods a **specific** TUI bug (scrollback dupes, PTY teardown crash), port **that PR’s files only** into `packages/tui` / InteractiveMode and re-run hermes-bridge contract tests.  
3. Documented upgrade path remains incomplete in `HERMES_GUT_PLAN.md` (`Document upgrade from OMP tip` still open) — fix that runbook **before** any multi-PR vendor refresh.  
4. Measure: cold `mtui` launch + stream scrollback under concurrent turns — if fine, lag is free.

## How to re-scan

```bash
SHA=$(cat /home/nixos/omherm/.omp-upstream-sha)
git -C /tmp/oh-my-pi-src fetch origin
git -C /tmp/oh-my-pi-src log --oneline ${SHA}..origin/main | head
git -C /tmp/oh-my-pi-src rev-list --count ${SHA}..origin/main
```

---

*Scan: Grok · 2026-07-27 · CADILLAC / ADR-0114 · coat not gut*


## Landed selective ports (2026-07-27 H4.1 coat)

| Upstream | Port |
|----------|------|
| #6788 / `23ec7e725` | PTY disconnect: best-effort raw-mode restore + guarded disconnect handler |
| #6782 / `6460ba042` | Editor word/line delete + yank via keybindings registry; WT 0x08 → ctrl+backspace |
| tests | editor word-delete + keys WT disambiguation + terminal disconnect raw-mode throw |

**Skipped:** bulk vendor, scrollback command-controller (#6768 — conflicts), title FFI, catalog/MCP.

