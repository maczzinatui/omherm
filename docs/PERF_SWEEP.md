# Perf sweep — coat paint + boot (omherm)

**Stamp:** 2026-07-24 · stream-scoped coalesce + spinner contract + boot marks  
**Bar:** Cadillac coat paint ownership · no default dual path · measure before forever-on.

## What changed

| Slice | Behavior | Default |
|-------|----------|---------|
| **Stream paint coalesce** | `setStreamPaintCoalesce(true)` on `agent_start`, `false` on `agent_end` | **On during turn only** — idle/stock TUI |
| **Env coalesce** | `OMHERM_PAINT_COALESCE=1` / `MTUI_PERF=1` / `MTUI_PAINT_COALESCE=1` | Always-on when set; stream arm/disarm no-ops |
| **Boot marks** | `bootMark(name)` → `[omherm-boot] name=+Nms` when perf env on | In-memory always; stderr when `MTUI_PERF`/`OMHERM_PERF` |
| **Spinner contract** | Pending spinner only if renderer `animatedPendingPreview` **or** not static custom-tool | bash/github/static custom **do not** tick |
| **Mid-stream dispose** | `HermesBrain.dispose` emits notice + `forceEnd` before kill | Fail-loud into EventController |

## Measure

```bash
# Boot timeline + paint counters (stderr)
MTUI_PERF=1 omh
# or
OMHERM_PERF=1 omherm

# Always-on coalesce (overrides stream-scoped — dogfood regression check)
OMHERM_PAINT_COALESCE=1 MTUI_PERF=1 omh
```

Marks currently stamped:

- `hermes_brain_bootstrap_start` / `hermes_brain_bootstrap_done`
- `tui_constructed`
- `tui_first_frame`

Rolling paint line (every 5s while active):

```
[omherm-perf] reason=tick window=5.0s forced=… scheduled=… scoped=…
```

**Receipts to look for under live Hermes stream:**

- `scoped >> forced` → healthy streaming path  
- `forced >> scoped` → overlay / status invalidation storm  
- Stream arm on: fewer raw `requestRender` bursts than brain ticks (pair with unit tests)

## Non-goals

- Default always-on coalesce at idle (rename/scrollback lesson)  
- Markdown lex fork / React  
- Dual brain / hub HANDOFF thrash  

## Tests

```bash
cd packages/coding-agent && bun test test/modes/components/tool-execution-spinner.test.ts test/modes/utils/perf-counters.test.ts
cd packages/hermes-bridge && bun test src/hermes-brain.test.ts
```
