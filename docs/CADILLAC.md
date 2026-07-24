# omherm engineering bar (Cadillac)

**Stamp:** 2026-07-23 · **Binding** for every package, doc, and PR in this repo.

This is not vibes. If the repo is public tomorrow, a cold reader should be able to audit ownership, contracts, and debt without asking us. Ship work you would sign.

Companion plans: `HERMES_GUT_PLAN.md`, `INTEGRATION_CROSSOVERS.md`, `KANBAN_PORT.md`.

---

## Product sentence

**Hermes is the brain. OMP InteractiveMode is the coat. omherm is the product.**

One launch path. One agent loop. One place truth lives for each concern. Coat chrome may be beautiful; it does not get a second brain.

---

## Pride test (before merge)

Ask every slice:

1. **Name on it** — Would you defend this file in a public code review without hedging?
2. **Cold reader** — Can someone who never met us find the contract in ≤2 hops from README?
3. **Churn** — When Nous ships Hermes next week, does one adapter move or does half the UI rot?
4. **Debt** — Is temporary ugliness named, gated, fingerprinted, and scheduled — or smuggled?
5. **Frankenstein** — Did we glue two products and call it integration?

Fail any → do not land as "good enough for now" without an explicit debt block in the PR/doc.

---

## Ownership map (no dual writers)

| Concern | Owner | Client may |
|---------|--------|------------|
| Agent loop, tools, skills, memory, profiles | Hermes (`hermes-agent` / gateway) | Call public RPC, slash catalog, CLI |
| Task board state machine | Hermes kanban (`kanban_db` via CLI/API) | CLI verbs, official dashboard API |
| Cron job definitions, fires, run history | Hermes gateway scheduler | `cron.manage` RPC, `hermes cron` CLI |
| Profile homes, sticky default, profile gateways | Hermes profile CLI + dirs | `ProfilePort` / `hermes profile` |
| Session transcript of record | Hermes session store | `session.*` RPC; readonly DB only if RPC incomplete |
| OMP provider/tool harness | Dead on product path | Not live beside Hermes tools |
| Paint, theme, footer, transcript chrome, settings shell | This repo (coat) | Own UI state and coat-local prefs |
| Upstream OMP tip | `.omp-upstream-sha` + re-apply bridge patches | Vendor, do not silently fork forever |

**Rule:** if two systems can write the same fact, we failed. Pick one writer.

---

## Public surfaces only (Hermes)

Prefer, in order:

1. **Gateway JSON-RPC / events** documented or stable in tui_gateway  
2. **`hermes` CLI** with `--json` where available (flags = contract)  
3. **Official plugins** (e.g. kanban dashboard HTTP) when that service is the product path  
4. **Readonly** filesystem / SQLite for speed or missing list RPCs  
5. **Version-pinned write shim** only when (1–3) lack a content path — single module, fingerprint, fail loud, upstream ask filed  

Never: patch `~/.hermes/hermes-agent` from this product. Never: copy Herm React tabs as the forever UI.

Herm fork (`~/herm`) is **research**: field checklists, write-class comments, UX keys. Not a dependency.

---

## Adapter discipline

Every external system gets **one port**:

| Port | Responsibility |
|------|----------------|
| `hermes-bridge` | Gateway connect, session create/prompt/interrupt, event map → UI |
| `KanbanPort` (see `KANBAN_PORT.md`) | Board DTO + create/lifecycle/content edit ladder |
| `CronPort` (see `CRON_PORT.md`) | Jobs list/detail, create/edit, pause/run, outputs via `cron.manage` + CLI |
| `ProfilePort` (see `PROFILE_PORT.md`) | Profile list/active/sticky; use/create/delete via CLI; no .env leak |
| Slash merge edge | Gateway command catalog + small local intercept set |
| Settings host | OMP settings chrome; panels call ports, not raw SQL |

Ports expose **our DTOs**. UI never imports raw gateway payload shapes or SQL column names across the tree.

Contract tests live next to the port. Bump Hermes or OMP → run the port suite first.

---

## Coat vs gut (OMP)

**Keep:** InteractiveMode chrome, themes, footer, assistant-message, tool paint, settings selector, pi-tui engine.

**Replace behind a thin session facade:** turn loop, tools, model registry, session DB of record, slash that mutates agent state.

**Do not:** rebuild footer/tools from zero; run dual tools; treat experimental bridge shell as the product face; spray Hermes calls through 4k-line InteractiveMode — map at the EventController edge.

Upstream refresh: record SHA, re-apply a **small patch set**, keep hermes-bridge a sibling package.

---

## UX bar

- First-class panels (Kanban, Cron, **Profiles**, sessions, models) feel intentional inside **OMP settings / selectors / slash**, not a second top tab strip.
- Create/edit forms match real Hermes capability (Herm field parity where CLI/API supports it; no fake disabled buttons without copy explaining the gap).
- Cron visibility is product-grade: last/next run, last status/error, scheduler heartbeat — not a dump of raw JSON.
- Empty, loading, schema-mismatch, and gateway-down states are designed — not blank panes.
- Performance: coalesce paint, seal scrollback, mutate text in place (see crossovers). Latency is part of craft.
- Branding is Hermes end-to-end (title, footer, notify, Orca icon via OSC). Coat package names may still say oh-my-pi internally until rename is cheap.

---

## Code craft

- Small modules with one job; names that survive grep.
- Types at boundaries; parse CLI/JSON fail loud.
- Tests for mappers and ports before "looks fine in TUI."
- No drive-by renames across vendored OMP trees.
- Comments explain **why** and **ownership**, not narration.
- Secrets never in repo; config paths documented.
- Public docs: sharp, specific, no hype sludge. Internal tactical notes can be blunt.

---

## Debt protocol

Allowed temporary debt only if all of:

1. Named in `docs/` or PR with owner + exit condition  
2. Gated (env, fingerprint, feature flag)  
3. Fail-loud when upstream moves  
4. Tracked on the board (`hermes kanban`) or HANDOFF  

Unnamed debt is a defect.

---

## Anti-patterns (reject on sight)

- Frankenstein: OMP tools + Hermes tools both live  
- Second coordinator (Orca orch bus, markdown board as SoT)  
- Herm top task bar reintroduced  
- SQLite writers outside a version-pinned port  
- Status transitions via raw SQL  
- "Just one more component on the thin shell" as product direction  
- Absorbing multi-file grind into cloud chat when workers/ports should own it  
- Shipping mapper claims without tests  
- README / plan drift vs launch path (`omherm` default)

---

## Review checklist (paste into PRs)

- [ ] Ownership table still true for touched concern  
- [ ] New Hermes touch goes through a port or documented public surface  
- [ ] Contract test added or explicitly N/A  
- [ ] No dual write introduced  
- [ ] Debt named + fingerprinted if any  
- [ ] UX: loading/error/empty considered  
- [ ] Branding / launch path unchanged unless intentional  
- [ ] Cold reader can find the design doc link  

---

## North star

Someone clones this repo cold. They run `omherm`, read `docs/CADILLAC.md` and the gut plan, and think: **these people knew what they were building and refused to fake it.**

That is the bar. Every slice either raises it or does not ship.
