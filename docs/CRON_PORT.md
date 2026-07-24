# CronPort — first-class scheduler visibility under OMP settings

**Stamp:** 2026-07-23 · Cadillac ownership for Hermes cron.  
**UI home:** Settings hub category (same shell as Kanban; no Herm top tab bar).  
**Research:** `~/herm/src/tabs/Cron.tsx` + `cron-model.ts` + `dialogs/cron-editor` (parked).

Unlike kanban content-edit, cron already has a **public gateway RPC** and a full CLI. Prefer RPC; CLI is fallback and contract-test harness.

---

## Goal

Operator sees every job: schedule, enabled, last/next run, last status, delivery, prompt/script, recent outputs. Create/edit/pause/resume/run/remove without leaving omherm. No second scheduler. No silent local cron.

---

## Ownership

| Fact | Owner |
|------|--------|
| Job definitions, fire times, run history | Hermes gateway scheduler |
| Delivery to platforms | Hermes gateway |
| Coat list/detail/editor chrome | omherm |
| Output file retention policy | Hermes `cron.output_retention` config |

**Never:** invent a parallel job store in OMP. **Never:** fire jobs from the TUI process.

---

## Public surfaces (prefer order)

1. **Gateway `cron.manage`** (Herm primary path)
   - `action: list` → jobs + optional `actions` / `fields` / `capabilities`
   - `action: add` | `update` | pause/resume/run/remove as gateway supports
   - Capability-gate the editor: if `update` missing, detail is read-only with clear copy (Herm already toasts this)
2. **`hermes cron …` CLI** — list/create/edit/pause/resume/run/remove/status/runs/tick  
   Use for contract tests and when RPC is down (show degraded banner, do not pretend live ticker)
3. **Readonly output files** — Herm `readCronOutput(jobId)` under Hermes home (last N run markdown). Document path; fail soft if missing
4. **No write shim / no SQLite twin** for cron job rows

---

## DTO (UI shape)

Normalize gateway/CLI raw → stable types (Herm `normalize` is the checklist):

```ts
CronJob: id, name, prompt, schedule, enabled, state, deliver, repeat?,
  last_run?, next_run?, last_status? ('ok'|'error'), last_error?,
  paused_reason?, provider?, model?, base_url?, no_agent?, attach_to_session?,
  skills?, context_from?, enabled_toolsets?, workdir?, script?

CronRun: attempt rows from `hermes cron runs` / history when exposed
CronSchedulerStatus: gateway running, ticker heartbeat age, active count
```

UI binds **only** DTOs. Raw field aliases (`job_id` vs `id`, `last_run_at` vs `last_run`) die in the mapper.

---

## Create / edit field parity (Herm editor + CLI)

**Core (always)**

| Field | Notes |
|--------|--------|
| name | optional human label |
| schedule | `30m` / `every 2h` / cron expr |
| prompt | self-contained task text (unless script-only) |
| deliver | origin / local / platform targets |
| enabled | pause/resume verbs |

**Advanced (capability-gated via list `fields` / `capabilities.advanced*`)**

| Field | Notes |
|--------|--------|
| script | path under `~/.hermes/scripts/` |
| no_agent | script IS the job; empty stdout = silent |
| skills | multi |
| provider / model / base_url | job model override |
| context_from | chain job ids |
| enabled_toolsets | restrict tools |
| workdir | absolute project cwd + context files |
| attach_to_session | continuable delivery |
| repeat | count |

If gateway omits a field from `fields`, hide or disable with reason — do not send unknown keys and hope.

---

## Actions (first-class)

| Action | Path |
|--------|------|
| List (+ disabled) | `cron.manage list` / `hermes cron list --all` |
| Scheduler health | `hermes cron status` (PID, ticker heartbeat) |
| Create | RPC add or `hermes cron create` |
| Edit | RPC update when capability says so |
| Pause / resume | RPC or CLI |
| Run now | RPC/CLI `run` (next tick) |
| Remove | confirm danger |
| Runs / history | `hermes cron runs [job_id]` |
| Last output preview | readonly output files (N lines) |

---

## UX (settings → Cron)

| Slice | Scope |
|-------|--------|
| **v0** | Job table: ●/○ enabled, name, schedule, last, next, status color; detail KV; scheduler status banner; pause/resume/run/remove; reload |
| **v0.5** | Create + edit form (core); output tail in detail |
| **v1** | Advanced fields gated by capabilities; runs history table; filter enabled/error only |
| **Polish** | next-run countdown, error toast on failed last_status, deep-link from slash `/cron` if catalog has it |

Keys (Herm reference, adapt to OMP): n new, e edit, p pause/resume, r run, d delete, R reload.

Empty state: “No jobs — gateway ticker is {up/down}. Create or `hermes cron create`.”

---

## Module shape (target)

```
packages/hermes-bridge/   # or packages/cron-port/
  cron-port.ts            # façade
  cron-rpc.ts             # cron.manage
  cron-cli.ts             # fallback + tests
  cron-dto.ts             # normalize + draft validate
  cron-output.ts          # readonly last outputs
  *.test.ts
```

Settings Cron panel imports façade only. Same pattern as `KANBAN_PORT.md`.

---

## Contract tests

1. `cron.manage` list shape fixture → normalize snapshot  
2. Create → list contains id (RPC or CLI against live/mock)  
3. Pause → enabled false; resume → true  
4. Capability without update → updateContent/edit rejects with typed error  
5. `hermes cron status` parse does not throw on common outputs  
6. Mapper tolerates `job_id` vs `id` and missing optional fields  

---

## Anti-patterns

- Porting Herm Cron.tsx wholesale into React-on-pi-tui  
- Second scheduler in omherm  
- Writing job JSON files by hand instead of RPC/CLI  
- Ignoring capabilities and sending full advanced payload always  
- Hiding last_error / failed last_status (visibility is the product)  
- Dual deliver paths that bypass Hermes  

---

## Relation to slash

Gateway command catalog may already expose cron-related slash. Settings panel is **visibility + management**; slash remains power-user. Both call CronPort — not two implementations.
