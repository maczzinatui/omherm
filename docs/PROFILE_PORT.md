# ProfilePort — first-class Hermes profiles under OMP settings

**Stamp:** 2026-07-23 · Cadillac ownership for Hermes profiles.  
**UI home:** Settings hub category (with Kanban + Cron; no Herm top tab bar).  
**Code:** `packages/hermes-bridge/src/profile-*.ts`  
**Research:** `~/herm/src/service/hermes-profiles.ts` + `tabs/Agents.tsx` (parked).

---

## Goal

List every profile, see which the **gateway** considers active, sticky default, model/provider peek, gateway pid alive, skill count, distribution manifest summary. Create / use / delete / describe / update via **CLI only**. Never dual-home the coat.

---

## Ownership

| Fact | Owner |
|------|--------|
| Profile dirs, config, env, skills, memory | Hermes (`~/.hermes` + `profiles/<name>/`) |
| Sticky default | Hermes `active_profile` file via `hermes profile use` |
| Which home the live gateway uses | Gateway process (`config.get` key `profile` / launch HERMES_HOME) |
| Coat list chrome + confirms | omherm |

**Never:** rewrite another profile's `config.yaml` from UI except through CLI.  
**Never:** read or display `.env` secrets (boolean `has_env` only).  
**Never:** silent cross-profile skill/memory edits (Hermes cross-profile guard).

---

## Public surfaces

1. **Readonly FS inventory** under Hermes root (default home + `profiles/*`) — same model as Herm  
2. **Active identity** — prefer gateway `config.get { key: "profile" }` home path; fall back to process `HERMES_HOME`  
3. **Mutations** — `hermes profile <verb>` only (`list` optional for doctor/status text)  
4. **No** profile SQLite twin; **no** write shim

CLI verbs we expose in the port:  
`list`, `show`, `use`, `create`, `delete`, `describe`, `rename`, `install`, `update`, `info`  
(alias/export/import = v1+)

---

## DTO

```ts
ProfileInfo {
  name: string              // "default" or slug
  path: string              // absolute HERMES_HOME for that profile
  is_default: boolean
  is_active: boolean        // matches gateway home, not omherm env alone
  is_sticky: boolean        // active_profile file
  gateway_running: boolean  // gateway.pid alive
  model: string | null
  provider: string | null
  has_env: boolean
  skill_count: number
  has_alias: boolean
  soul_preview: string      // truncated, no secrets
  distribution: DistributionSummary | null
  description: string | null  // from describe file if present
}
```

Name rule: `^[a-z0-9][a-z0-9_-]{0,63}$` (CLI is authoritative).

---

## Actions + UX copy

| Action | Path | UX |
|--------|------|-----|
| List | FS inventory + optional gateway home | Settings table |
| Use / switch | `hermes profile use <name>` | **Confirm:** gateway restarts under that home; current session ends; history stays on old profile |
| Create | `hermes profile create` | name + optional seed flags CLI supports |
| Delete | `hermes profile delete -y` | danger confirm; CLI stops that profile's gateway first |
| Describe | `hermes profile describe` | kanban orchestrator blurb |
| Update dist | `hermes profile update -y` | optional `--force-config`; warn if active |
| Show/info | CLI or FS detail pane | model, paths, distribution |

---

## Module map (implemented)

```
packages/hermes-bridge/src/
  profile-dto.ts     # types, name validation, profileNameFromHome
  profile-fs.ts      # root resolution, listProfiles, sticky, gateway.pid
  profile-cli.ts     # hermes profile spawn wrapper
  profile-port.ts    # façade: list, getActiveHome, use, create, delete, …
  profile-port.test.ts
```

Settings panel imports **ProfilePort** only.

---

## Slices

| Slice | Scope |
|-------|--------|
| **v0** | List + detail + active/sticky/gateway badges + reload (FS + config.get when gateway connected) |
| **v0.5** | use / create / delete with confirms |
| **v1** | describe, distribution install/update, rename, alias indicator actions |

---

## Contract tests

1. `profileNameFromHome` for default vs `…/profiles/foo`  
2. `validateProfileName` accept/reject  
3. list against real `~/.hermes` includes `default` when present  
4. CLI wrapper builds argv safely (no injection)  
5. use/delete refused without explicit confirm flag in façade API  

---

## Anti-patterns

- Porting Herm Agents.tsx wholesale  
- Treating omherm process env as “active” when gateway home differs  
- Editing sticky file or profile dirs with raw FS writes  
- Showing `.env` contents  
- Switching profile without warning about session/gateway restart  

---

## Relation to other ports

- **Kanban** boards are profile-agnostic at Hermes root (shared board) — profile switch does not fork the board path by default (Herm gh#28).  
- **Cron** jobs live under the gateway's profile home — list after switch reflects new home.  
- **Session** brain stays on the gateway it connected to until reconnect after `use`.
