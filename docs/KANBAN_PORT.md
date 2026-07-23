# KanbanPort — first-class board under OMP settings

**Stamp:** 2026-07-23 · Implements Cadillac ownership for Hermes kanban.  
**UI home:** Settings hub category (no Herm top tab bar).  
**Research only:** `~/herm` create form + write-class split (parked fork).

---

## Goal

Herm-grade create/edit/lifecycle inside mtui, without reimplementing `kanban_db.py` or forking hermes-agent.

---

## Write classes

| Class | Examples | Path |
|-------|----------|------|
| **A — State machine** | create, assign, comment, block, unblock, promote, archive, link, dispatch, specify, decompose, complete | `hermes kanban --board <slug> <verb> …` (prefer `--json`) |
| **B — Content fields** | title, body, priority on open tasks | Ladder below |
| **C — Coat prefs** | open boards, filter chips, layout | mtui/OMP local config only |

CLI note (live 2026-07-23): `hermes kanban edit` is **done-task recovery** (result/summary/metadata), not title/body/priority.

---

## Content ladder (class B)

1. Gateway RPC if present (probe on Hermes bump)  
2. Official kanban dashboard `PATCH /tasks/:id` if plugin is the operator path  
3. Future first-class CLI (`update` / expanded `edit`) — swap impl, keep DTO  
4. **Debt shim:** one module, SQL aligned with dashboard plugin_api PATCH + `task_events`; `HERMES_KANBAN_SCHEMA_FINGERPRINT` (or hermes version + schema probe); fail loud on mismatch  
5. Never ad-hoc SQL from UI components  

Upstream ask (exit for shim): CLI content update for title/body/priority with events parity.

---

## Create field parity (Herm form → CLI)

**Core:** title, body, assignee, priority, triage  

**More:** tenant, project, workspace (`scratch` | `worktree` | `dir:<path>`), max-runtime, skills (`--skill` repeatable)  

**Extras:** parent (`--parent`), board slug, optional goal flags when we expose advanced create  

Submit = CLI only. Skills catalog = `skills.manage` list or equivalent public surface.

---

## Reads

- Prefer `list` / `show` / `stats` / `assignees` / `boards` JSON  
- Optional **readonly** SQLite for multi-column snappy paint  
- Map to DTOs: `KanbanTask`, `KanbanDetail`, `KanbanBoard` — UI never binds SQL columns  

---

## Module shape (target)

```
packages/hermes-bridge/  (or packages/kanban-port/)
  kanban-port.ts       # façade: list, show, create, transition, updateContent
  kanban-cli.ts        # argv builder + JSON parse
  kanban-dto.ts        # types + mappers
  kanban-content.ts    # ladder backends (api | shim)
  kanban-fingerprint.ts
  *.test.ts
```

Settings Kanban panel imports **only** the façade.

---

## Contract tests

1. Help/flag snapshot for verbs we call  
2. Round-trip create → show → assign → complete via CLI  
3. updateContent → show proves title/body/priority  
4. Fingerprint fails closed on schema drift  
5. No test doubles that pretend dual-write is fine  

---

## UX slices

| Slice | Scope |
|-------|--------|
| v0 | list/columns, detail, create (core+More), assign, comment, lifecycle CLI, reload, empty/error |
| v0.5 | content edit via ladder, filters, child create |
| v1 | specify/decompose/dispatch/log/runs, multi-board, diagnostics |

---

## Anti-patterns

- Porting `herm/src/tabs/Kanban.tsx` wholesale  
- Status via SQL  
- Content writes outside ladder  
- Silent no-op when fingerprint mismatches  
