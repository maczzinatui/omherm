# Herm → OMP /settings map

**Stamp:** 2026-07-23 · Binding product placement.

## Intent

Herm fork tabs (Config groups from `schema.ts` + MERGE in `config/index.ts`) are the **source of truth for what Hermes can configure**. OMP `/settings` is the **chrome**. We do not invent a second sidebar — we place Hermes keys into existing OMP tabs/groups.

## Code

| Artifact | Role |
|----------|------|
| `packages/hermes-bridge/src/hermes-omp-settings-map.ts` | Curated field list + OMP tab/group |
| `packages/hermes-bridge/src/hermes-config-port.ts` | get/set allowlist = that map |
| `hermes-settings-fields.ts` | Inject defs into `getSettingsForTab` |
| Settings → Model → **Open model selector…** | Launches OMP ModelHub; default assign dual-writes Hermes |

## Herm group → OMP tab

| Herm (raw/merged) | OMP tab | OMP group(s) used |
|-------------------|---------|-------------------|
| display (+ skin, streaming chrome) | **appearance** | Theme, Status Line, Display |
| agent (reasoning, turns, verify, coding) | **model** | Thinking, Prompt, Sampling, Retry & Fallback, Vision, Advisor |
| auxiliary.compression model | **model** | Prompt |
| delegation model/provider | **model** | Advisor |
| approvals | **interaction** | Approvals |
| display.busy_* | **interaction** | Input |
| agent.gateway_*, clarify | **interaction** | Input / Agent / Notifications |
| stt | **interaction** | Speech |
| compression | **context** | Compaction |
| timezone | **context** | General |
| memory | **memory** | General |
| terminal | **shell** | Bash |
| browser | **tools** | Grep & Browser |
| skills | **tools** | Discovery & MCP |
| delegation concurrency | **tasks** | Subagents |
| kanban, cron | **tasks** | Modes |
| tts / stt models | **providers** | Services |
| security / privacy | **providers** | Privacy |
| model_catalog | **providers** | Protocol |

## Explicitly not in settings (yet)

- `approvals.deny` list editor  
- auxiliary.*.extra_body / API keys (use hermes config / .env)  
- Kanban/Cron/Profiles **panels** (ports — separate from key-value rows)  
- Free-text `model.default` (use Model hub)

## Model hub in settings

OMP ModelHub is the model page. Entry points:

1. `/model`  
2. Settings → **Model** → first row **Open model selector…**  

Default role assign → OMP session + `applyHermesModelGlobal`.
