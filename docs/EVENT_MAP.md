# Hermes gateway → meshina-tui event map

**Source of truth for the wire:** Hermes `tui_gateway` notifications (`method: "event"`, params = event object).  
Herm reference implementation: `liftaris/herm` `src/context/wire.ts` + `events.ts` (study only; this repo owns its own types).

**UI target:** OMP-class **in-transcript** process trail (thinking + tools inline in the assistant turn) + two-line footer. Paint with `@oh-my-pi/pi-tui` primitives — do not vendor OMP agent core.

## Transport

| Mode | How | Env |
|------|-----|-----|
| **Local (default)** | Spawn `python -m tui_gateway.entry` from `HERMES_AGENT_ROOT` (~/.hermes/hermes-agent) | `HERMES_AGENT_ROOT`, `HERMES_PYTHON`, `HERMES_CWD` / `TERMINAL_CWD` |
| **Remote WS** | Connect JSON-RPC over WebSocket | `HERMES_TUI_GATEWAY_URL` or `HERM_GATEWAY_URL` → normalized to `…/api/ws` |

Framing: newline-delimited JSON-RPC 2.0. Requests carry `session_id` once set. Events arrive as `{ "method": "event", "params": { "type": "…", "payload": … } }`.

## RPC (bootstrap + turn)

| Method | Role |
|--------|------|
| `session.create` | New session → `{ session_id, info? }` |
| `session.resume` | Resume → messages + info |
| `session.list` / `session.active_list` | Session browser |
| `prompt.submit` | User turn `{ text }` |
| `session.interrupt` / `session.steer` | Control in-flight turn |
| `approval.respond` / `clarify.respond` / `secret.respond` / `sudo.respond` | Modal chrome |
| `config.get` / `config.set` | Model / profile chrome |
| `skills.manage` / `toolsets.list` / `tools.configure` | Catalog chrome |
| `shell.exec` | Escapes (kanban CLI, etc.) — prefer first-class RPCs when they exist |
| `delegation.status` / `subagent.interrupt` | Multi-agent chrome |
| `cron.manage` | Cron chrome |

## Events → timeline model

Timeline unit = **Turn** with ordered **segments** (user | thinking | tool | text | system | error | subagent | prompt).

| Gateway `type` | Timeline action | Notes |
|----------------|-----------------|-------|
| `gateway.ready` | connect ready; optional skin | Footer: Connected |
| `gateway.stderr` / `gateway.start_timeout` / `gateway.protocol_error` | system/error | Surface, don't swallow |
| `session.info` | footer model/tools/skills/usage | Also system line once |
| `session.title` | footer / header title | |
| `message.start` | open assistant text segment | |
| `message.delta` | append text | Prefer `text` over `rendered` for source |
| `message.complete` | close text; apply usage; honor `status` error/interrupted | |
| `thinking.delta` | append thinking (collapsed by default, pulse while open) | |
| `reasoning.delta` / `reasoning.available` | same lane as thinking unless verbose split | |
| `tool.start` | tool card open (`tool_id`, name, args) | In-transcript status line |
| `tool.progress` / `tool.generating` | update card preview | |
| `tool.complete` | close card (summary/error/duration) | |
| `status.update` | footer status / transient | |
| `notification.show` / `.clear` | toast/sticky strip | |
| `clarify.request` | blocking prompt UI | |
| `approval.request` | blocking approval UI | |
| `sudo.request` / `secret.request` | blocking secure UI | |
| `subagent.*` | nested card / tree | |
| `voice.status` / `voice.transcript` | voice chrome | |
| `background.complete` | system / notice | |
| `error` | error segment | |
| `moa.*` | optional reference blocks | later |

## Footer model (two lines)

**L1:** `cwd (branch?)` · session title/id short  
**L2:** `Ready|Streaming|Waiting` · model · ctx% · tools/skills counts · voice state

Mapped mainly from `session.info`, `status.update`, turn phase, usage on `message.complete`.

## ACP (optional secondary)

| ACP update | Rough gateway analog |
|------------|----------------------|
| `agent_thought_chunk` | `thinking.delta` |
| `agent_message_chunk` | `message.delta` |
| tool call start/complete | `tool.start` / `tool.complete` |
| `plan` | todo-derived plan (gateway may only expose via tool results) |

Use ACP for Zed/embed. **Daily meshina-tui path = gateway.** Shared reducer interface: both adapters emit the same timeline actions.

## Toolbar chrome (Herm parity — product requirement)

Operator wants the **top toolbar** usability from Herm, not chat-only:

| Panel | Wire (see `src/chrome/`) |
|-------|--------------------------|
| Chat | turn events + `prompt.submit` |
| Sessions | `session.list` / `active_list` / `resume` / `delete` / `title` |
| Kanban | `shell.exec` → `hermes kanban` (until first-class RPC) |
| Models / Config | `config.get` / `config.set` |
| Skills | `skills.manage` |
| Toolsets | `toolsets.list` / `tools.configure` |
| Agents | `delegation.status` / `subagent.interrupt` |
| Cron | `cron.manage` |
| Memory / Context | shell + `session.context_breakdown` |

Tier-0 dogfood: Chat + Sessions + Kanban + Models. Rest load on tab focus.

Reimplement panels in pi-tui — **do not copy Herm React trees**.

## Spike acceptance (M1′.b)

One attended turn where operator sees **live**:

1. thinking stream (or pulse if collapsed)  
2. at least one tool card open→complete  
3. final assistant text  

Receipt: screenshot or terminal capture + note of `session_id` and model from `session.info`.

## Non-map (do not invent)

- OMP tool harness as execution path  
- Dual coordinators  
- Silent drop of approval/clarify events  
