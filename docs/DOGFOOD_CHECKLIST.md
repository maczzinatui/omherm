# mtui dogfood / debug list — 2026-07-24

**After any coat/bridge edit: quit + relaunch `mtui` (no HMR).**  
Binary: `/home/nixos/.bun/bin/mtui` · Repo: `~/meshina-tui` · Branch `main` (local commits; may be ahead of origin).

Commits this arc (local): `e99cba2` P2 overlays · `4859f6f` perf TTL · **latest** board switch + slash pager + sessions debt.

---

## 0. Boot sanity (30s)

- [ ] `mtui` starts without stack dump
- [ ] Footer shows Hermes branding / brain notice once
- [ ] Status line shows model / context% (not frozen forever)
- [ ] Mouse + keyboard both work in chat

**Fail:** paste terminal stderr from launch.

---

## 1. P0 safety

### 1a Approvals + clarify → ask-dialog
- [ ] Trigger a tool that needs approval (or force gateway approval)
- [ ] Dialog is **ask-dialog**, not a silent notice-only line
- [ ] Accept / reject both land; agent continues or stops correctly
- [ ] Clarify with choices: pick option + free-text path if offered

**Fail:** only a toast/notice; no modal · crash on open · double-submit

### 1b Slash.exec
- [ ] `/yolo` (or `/help` if safer) with **gateway up**
- [ ] Short result → notice/status
- [ ] Long result → **fullscreen pager** (↑↓ / Pg / Esc) + optional path under `~/.hermes/tmp/mtui-slash/`
- [ ] Dead gateway → **warning** `slash.exec failed:…` (not silent)

### 1c Port mutation fail-loud
- [ ] Kanban: archive or complete a task while Hermes CLI broken / renamed → **red banner**, no freeze
- [ ] Cron pause on bad job id → banner with error text
- [ ] Skills enable/disable on junk name → banner, list still usable

---

## 2. P2 inventory (crash class)

- [ ] Settings → Tasks → **Open Skills…** — no crash, 80+ rows
- [ ] Same: Tools, Memory
- [ ] Slash: `/skills` `/tools` `/memory` `/subagents`
- [ ] Esc returns to Settings (not full quit)
- [ ] Second open of Skills is **fast** (TTL cache ~8s)
- [ ] Subagents overlay opens empty OK; after a real subagent run, trail shows notices

---

## 3. Kanban board switch (new)

- [ ] Settings → Kanban title shows `Kanban · <slug> (N)`
- [ ] Action **Board: …** or key **`B`** opens slug form
- [ ] Help line lists known boards if any
- [ ] Switch to `default` (or another board if you have one) → reload list
- [ ] Mutations (comment/complete) target current board
- [ ] Invalid slug → form error, no crash

CLI ground truth: `hermes kanban boards list` / `boards show`

---

## 4. Sessions picker (Hermes SoT)

**Where to find it (was missing from menu):**
- Settings → **Tasks** → group **Sessions** → **Open Sessions…**
- Slash: `/sessions` or bare `/resume`
- Key: **Ctrl+Shift+R** (app.session.resume)

- [ ] Overlay lists Hermes sessions (gateway, not empty OMP coat files)
- [ ] Enter / click resumes; notice shows title + live id
- [ ] Further prompts stay on resumed Hermes session
- [ ] Coat full history replay may still be incomplete (named debt) — prompts work

Do **not** expect Herm React Sessions tab chrome; this is OMP coat + Hermes list.

---

## 5. Image paste

- [ ] Paste clipboard image into editor
- [ ] Marker `[Attached image: ~/.hermes/tmp/mtui-paste/…]` appears
- [ ] File exists on disk
- [ ] Send turn — model may not “see” pixels (no gateway image RPC); path-only is expected

---

## 6. Perf / feel

- [ ] Open Skills twice quickly — second open snappy
- [ ] Hover Skills list — no obvious paint stutter
- [ ] After a full Hermes turn, context% updates (or at least moves next status paint)
- [ ] Port overlays don’t freeze mouse for multi-second CLI (list already async)

---

## 7. Regression smoke

- [ ] `/kanban` `/cron` `/profile` deep-links
- [ ] Kanban create + comment still work
- [ ] Cron list + runs pane
- [ ] Profiles use/delete still confirm
- [ ] `MESHINA_TUI_OMP_BRAIN=1 mtui` still boots coat-only escape (optional)

---

## Debug dumps (if something dies)

```bash
# from a second terminal
cd ~/meshina-tui/packages/hermes-bridge && bun test
hermes skills list | head
hermes kanban boards list
hermes sessions list --limit 5
ls -la ~/.hermes/tmp/mtui-paste/ ~/.hermes/tmp/mtui-slash/ 2>/dev/null | tail
```

- Note: **key**, **overlay name**, **stderr**, whether Settings was open
- Width overflow crash class = throw in `render()` — check last coat file touched

---

## Explicit non-goals (don’t dogfood as bugs)

- Dual brain / Herm React tabs  
- True multimodal vision paste  
- Hermes sessions resume UI (port exists; wire open)  
- Live `config.set` mid-session  
- HMR (always relaunch)

---

## Pass bar

Ship-quality dogfood if **§0 + §1a–c + §2 Skills + §3 board form + §4 warning** all green.  
Everything else is polish/P1.
