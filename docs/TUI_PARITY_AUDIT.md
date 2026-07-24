# TUI parity audit — native Hermes · OMP coat · Herm fork · mtui

**Stamp:** 2026-07-23 · Product path: **mtui** = OMP chrome + Hermes brain (no Herm top tab bar).

Companion: `HERMES_BRAIN.md`, `CADILLAC.md`, `CRON_PORT.md`, `KANBAN_PORT.md`, `SETTINGS_REMAP.md`.

---

## Already in shape

| Area | Notes |
|------|--------|
| Chat stream + tools | HermesBrain + GatewayTurnMapper; complete de-dupe |
| OMP tool/user paint | Stock slabs (operator preference) |
| Settings remap + Hermes keys | ConfigPort; hermes:* never hits OMP store |
| Model hub dual-write | OMP hub + Hermes default |
| Cron/Kanban table + detail | Herm density, OMP split chrome; v0 actions |
| Profiles | List inventory |
| Slash autocomplete | Builtins + skills scan |

---

## P0 — wrong/unsafe if missing

1. **Approvals + clarify → OMP ask-dialog** (gateway events). Notices-only is unsafe.
2. **Slash execution** — deep-link ports/settings/model; else `slash.exec` + result. Autocomplete without run = fake.
3. Stabilize settings crash + mapper de-dupe on product tree.

## P1 — dashboard replacement core

4. Cron create/edit form + last output; prefer `cron.manage` when live.
5. Kanban create + assign/comment + board switch; optional status columns.
6. Sessions: `session.list` / resume / new as Hermes DB picker.
7. Live `config.set` RPC for hot keys (reasoning, busy, skin).
8. `session.steer` while streaming.
9. Settings purge remaining OMP-brain lies.
10. Status line bound to gateway usage/context %.

## P2 — polish

11. Skills + toolsets panels  
12. Memory panel (USER/MEMORY)  
13. Subagent trail cards  
14. Interim/busy/skin live chrome  
15. Image attach / clipboard via gateway  
16. `/yolo` `/compress` `/goal` `/browser` handlers  
17. Profile switch confirm in-UI  
18. Event mapper: btw, review.summary, background.complete, browser.progress, moa.*

## P3 — later / skip

Analytics, Journey, Herm leader chords, dual brain, computer-use stack, web dashboard feature chase.

---

## Gateway RPC gap (Herm vs mtui brain)

| RPC / event | Herm | mtui | Pri |
|-------------|------|------|-----|
| `slash.exec` | yes | **shipping** | P0 |
| `cron.manage` | yes | CLI port | P1 |
| `config.set` live aliases | yes | CLI only | P1 |
| `session.steer` | yes | interrupt+new | P1 |
| `session.list/resume/activate` | yes | weak | P1 |
| `session.compress` / usage | yes | partial | P2 |
| `approval.respond` / `clarify.respond` | dialogs | **shipping ask-dialog** | P0 |
| `sudo` / `secret` | dialogs | missing | P1 |
| subagent / moa / voice / btw | yes | thin | P2 |

---

## Herm IA → mtui home (no top tab bar)

| Herm | mtui target |
|------|-------------|
| Automation/Kanban | Settings Tasks + `/kanban` |
| Automation/Cron | Settings Tasks + `/cron` |
| Automation/Profiles | Settings Tasks + `/profile` |
| Config/* | `/settings` Hermes rows + future panels |
| Sessions/* | OMP session chrome wired to gateway |
| Chat dialogs | ask-dialog host |

---

## Implementation log

| Date | Slice |
|------|--------|
| 2026-07-23 | Audit written |
| 2026-07-23 | P0 slash router (deep-link + slash.exec) |
| 2026-07-23 | P0 approval/clarify → ask-dialog |
| 2026-07-23 | P1 cron create/edit form + kanban create/assign (port UI) |
| 2026-07-24 | Mouse QoL: top-left overlays, list-backed detail, Esc stack, category hover |
| 2026-07-24 | Perf: async kanban/cron CLI (no spawnSync on TUI loop); soft reload; paint local helper |
| 2026-07-24 | Concrete backlog → `docs/REMAINING_WORK.md` |
