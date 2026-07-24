# Hermes gut-and-plug plan (OMP TUI → omherm)

**Decision (2026-07-23, operator):** stop rebuilding OMP UI piece-by-piece.  
Clone OMP source, **gut agent runtime**, **plug Hermes gateway**. Ship `omherm`.

## Non-goals

- Rebuild footer / assistant-message / tools cards / themes from zero
- Vendor OMP as the multi-agent coordinator
- Touch `~/.hermes/hermes-agent` internals except as a client of public wire
- Continue Herm OpenTUI polish as the forever cockpit

## Target architecture

```
┌─────────────────────────────────────────────┐
│  packages/coding-agent  InteractiveMode     │  KEEP almost all UI
│  components/*  theme  status-line  footer   │
└───────────────────┬─────────────────────────┘
                    │ thin adapter interface
                    ▼
┌─────────────────────────────────────────────┐
│  hermes-bridge (new)                        │
│  implements the session surface UI expects  │
│  → tui_gateway JSON-RPC (stdio or WS)       │
└───────────────────┬─────────────────────────┘
                    ▼
┌─────────────────────────────────────────────┐
│  Hermes (untouched)                         │
│  skills memory mesh kanban voice profiles   │
└─────────────────────────────────────────────┘
```

## What to KEEP (UI)

From `packages/coding-agent/src/`:

| Area | Path | Notes |
|------|------|--------|
| Shell | `modes/interactive-mode.ts` | Primary host — slim over time |
| Transcript | `modes/components/assistant-message.ts`, `chat-*`, `message-frame` | In-transcript trail |
| Footer | `modes/components/footer.ts`, `status-line/` | path (branch), tokens, model•effort |
| Theme | `modes/theme/` | Full OMP theme |
| Editor chrome | `modes/components/custom-editor.ts`, hooks | |
| Diff / tool paint | `modes/components/diff.ts`, execution-* | Visual only |
| pi-tui | `packages/tui` | Engine |

Also keep workspace deps those import: `packages/utils`, parts of `packages/wire` if UI uses them.

## What to GUT / replace

| OMP piece | Replace with |
|-----------|----------------|
| `AgentSession` turn loop | Hermes `prompt.submit` + event stream |
| `pi-ai` / provider registry | Hermes model routing (gateway already has model) |
| OMP tool harness (bash/edit/…) | Hermes tools via gateway events (`tool.start` / `tool.complete`) |
| OMP sessions DB | Hermes `session.*` RPCs |
| OMP slash that mutates agent | Map to Hermes slash / config RPCs or drop |
| ACP mode as default | Optional later; daily path = gateway |
| Compaction UI driven by OMP | Hermes context events / session.info usage |

## Adapter contract (minimal)

UI should depend on a narrow interface, not `AgentSession` forever:

```ts
interface CockpitSession {
  info(): SessionInfo           // model, effort, cwd, branch, usage, profile
  onEvent(cb: (ev: UiEvent) => void): () => void
  submit(text: string): Promise<void>
  interrupt(): Promise<void>
  // later: listSessions, resume, respondApproval, respondClarify…
}
```

Map gateway events → existing UI event controller shapes in  
`modes/controllers/event-controller.ts` (prefer adapting at the edge over rewriting every component).

## Phased work

### P0 — Boot stock OMP from this tree
- [x] Clean omherm of scratch scaffold
- [x] Vendor oh-my-pi packages + lockfile
- [ ] `bun install` green
- [ ] `omherm` wrapper can still run **stock** `omp` for visual reference

### P1 — Hermes bridge package
- [x] `packages/hermes-bridge/` with gateway client (stdio/WS)
- [x] Event map: gateway → UiEvent (thinking, tool, text, footer info)
- [x] session.create / prompt.submit / interrupt
- [x] refreshInfo via session.usage + config.get (session.info is event-only)
- [x] GatewayEvent → AgentSessionEvent edge mapper (`GatewayTurnMapper` + `HermesSessionEventSource`)
- [x] bun test hermes-bridge session-event-map (3 pass)

### P2 — InteractiveMode on bridge
- [x] New entry: `src/omherm.ts` — default full InteractiveMode; `--bridge` experimental
- [x] Bridge shell uses OMP ToolExecution + Markdown (not LineBox) + model•effort footer
- [x] Edge mapper + HermesBrain install (`docs/HERMES_BRAIN.md`) — product default Hermes loop under IM
- [ ] Prefer fork InteractiveMode and delete AgentSession coat-only surface over time
- [ ] First dogfood: one real Hermes turn with full OMP InteractiveMode chrome (operator)

### P2.5 — Crossovers (perf / memory / methods)
See `docs/INTEGRATION_CROSSOVERS.md` — paint coalesce, native scrollback seal, Hermes compaction UI, Grok Build method-steal only, approvals/steer, no dual brain.

### Engineering bar (binding, whole repo)
See **`docs/CADILLAC.md`**. Public-scrutiny quality, one owner per concern, ports only, named debt. Every package/PR.

### Settings truth (binding)
See **`docs/SETTINGS_REMAP.md`**. OMP/pi `settings-schema` (~428 keys) is **not** Hermes config. omherm product path filters via `settings-product-manifest.ts` (purge OMP agent lies; coat chrome only until HermesConfigPort). Ports (Kanban/Cron/Profiles) are hub panels, not OMP toggles.

### P3 — Hermes chrome inside OMP settings (no Herm top tab bar)

**Operator correction:** we do **not** need a Herm-style top task bar. OMP already has a strong **settings / selector** surface (`SettingsSelectorComponent`, session selector, model picker, etc.). Extend that:

- Add **Kanban**, **Cron**, **Profiles** as settings/hub categories — **`docs/KANBAN_PORT.md`**, **`docs/CRON_PORT.md`**, **`docs/PROFILE_PORT.md`**
- Sessions / models / config stay OMP-native UX wired to Hermes RPCs
- Avoid a second full-width tab strip that forces Tab-cycling
- Kanban create + content edit = Herm field parity via CLI + content ladder (not ad-hoc SQLite)
- Cron = `cron.manage` first; full last/next/status/output visibility
- Profiles = FS inventory + `hermes profile` mutations; gateway home = active

### P4 — Product cutover
- [ ] bin `omherm` / `omherm`
- [ ] Stock `hermes --tui` remains fallback until dogfood OK
- [ ] Document upgrade from OMP tip (`.omp-upstream-sha`)

## Anti-patterns (again)

- “Just add one more component to our scratch shell”
- Porting Herm React tabs into pi-tui mid-gut
- Copying OMP binary without source (can’t gut)
- Dual brains (OMP tools + Hermes tools both live)
- Anything that fails `docs/CADILLAC.md` pride test

## Upstream sync

```bash
# later: refresh vendor tip
git -C /tmp/oh-my-pi-src pull
# rsync carefully; re-apply hermes-bridge patches
```

Record SHA in `.omp-upstream-sha` every bump.
