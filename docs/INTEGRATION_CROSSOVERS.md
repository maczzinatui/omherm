# Integration crossovers — Hermes + OMP coat (meshina-tui)

**Stamp:** 2026-07-23 · Keep open while gutting. Not dual-brain.  
**Quality bar:** `docs/CADILLAC.md` (whole repo). **Kanban:** `docs/KANBAN_PORT.md`. **Cron:** `docs/CRON_PORT.md`. **Profiles:** `docs/PROFILE_PORT.md`.

## Already in flight

| Area | What | Why it matters |
|------|------|----------------|
| Event coalesce paint | `queueMicrotask` paint batching on bridge shell | message.delta storms shouldn't re-compose every token |
| Markdown.setText / Text.setText | mutate in place | avoid Container churn + GC thrash mid-stream |
| ToolExecutionComponent | OMP tool chrome on Hermes tool.* events | visual parity without inventing tool cards |
| session.usage refresh | footer tokens/context after turn | stock Hermes TUI already has this signal |
| config.get effort/model | sparse session.create payloads | model•effort always visible |

## High-value crossovers (do not forget)

### Performance / latency

1. **Prefix / prompt cache economics** — Hermes already tracks compressions + context_%; OMP status-line thresholds should bind to gateway usage events, not re-tokenize locally.
2. **Streaming reveal throttle** — OMP `StreamingRevealController` + 80ms tool spinner cadence (issue #4353 family). When plugging under InteractiveMode, map Hermes deltas into those controllers; don't double-paint.
3. **Native scrollback** — OMP commits sealed blocks to terminal scrollback. Hermes bridge must `seal()` tool/assistant blocks or long sessions balloon live region RAM.
4. **WS vs stdio gateway** — WS for multi-client / remote glass; stdio for local mtui (lower latency, one proc). Prefer stdio default on node-b; WS when E glass attaches.
5. **Grok Build OSS patterns** — agent loop / TUI / subagent view / plan mode / inline diff ([xai-org/grok-build](https://github.com/xai-org/grok-build)). Steal *methods* (fullscreen mouse TUI, plan review, subagent cards), not a second brain. Same doctrine as plasma-fractal: methods only.

### Memory / context

6. **Hermes LCM / compaction events** — surface gateway compress / context events in OMP compaction UI chrome (don't run OMP snapcompact against Hermes history).
7. **Session DB** — Hermes owns transcript; OMP session SQL is coat-local only if needed for UI bookmarks. No dual write of turns.
8. **Skill/memory lists on session.info** — footer or settings can show counts without loading skill bodies into UI process.

### Efficiency of integration (architecture)

9. **EventController edge adapter** — map gateway → `AgentSessionEvent` at one edge; do not rewrite 4.8k-line InteractiveMode. That is the real P2.
10. **Kanban / Cron / Profiles via settings** — ports over gateway/CLI; not a Herm tab bar. Cron: `cron.manage`. Profiles: `ProfilePort` + `hermes profile`.
11. **Approvals** — Hermes `approval.request` → OMP ask-dialog chrome (one approval UX).
12. **Interrupt / steer** — Escape → `session.interrupt`; later `session.steer` for mid-turn redirect (Hermes has it; OMP has queue/steer patterns).

### What we explicitly reject

- Dual tool harness (OMP bash/edit + Hermes tools live)
- Re-implementing Hermes agent loop inside coding-agent
- Porting Grok Build / OMP agent core as product brain

## Next slice order

1. ~~Edge mapper: UiEvent/GatewayEvent → AgentSessionEvent subset EventController needs for one turn~~
2. ~~Hermes-backed stub session for prompt/subscribe/interrupt only~~ (`HermesBrain` + install)
3. ~~Default mtui stays full InteractiveMode; flip brain when mapper green~~ (default ON; `MESHINA_TUI_OMP_BRAIN=1` escape)
4. Operator dogfood one real Hermes turn under full chrome (`docs/HERMES_BRAIN.md`)
5. Settings → Kanban/Cron/Profiles inventory landed; editors next
6. Optional research pass on grok-build TUI scrollback + plan review (steal, don't merge)
