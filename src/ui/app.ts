// Minimal pi-tui shell: Herm-class toolbar + gateway chrome + chat transcript.

import {
  Editor,
  ProcessTerminal,
  TabBar,
  Text,
  TUI,
  type Component,
  type Tab,
  type TabBarTheme,
} from "@oh-my-pi/pi-tui"
import { loadPanel } from "../chrome/panels.ts"
import { TOOLBAR, type TabId } from "../chrome/tabs.ts"
import { GatewayClient } from "../gateway/client.ts"
import type { SessionCreateResponse } from "../gateway/wire.ts"
import {
  applyEvent,
  formatFooter,
  formatSegment,
  initialState,
  pushUser,
  type State,
} from "../timeline/model.ts"

class LineBox implements Component {
  private lines: string[] = []
  set(lines: string[]) {
    this.lines = lines.length > 100 ? lines.slice(-100) : lines
  }
  render(width: number): readonly string[] {
    return this.lines.map((l) => (l.length > width ? l.slice(0, Math.max(0, width - 1)) + "…" : l))
  }
}

class FooterView implements Component {
  private l1 = ""
  private l2 = ""
  set(state: State) {
    ;[this.l1, this.l2] = formatFooter(state.footer)
  }
  render(width: number): readonly string[] {
    const clip = (s: string) => (s.length > width ? s.slice(0, Math.max(0, width - 1)) + "…" : s)
    return [clip(this.l1), clip(this.l2)]
  }
}

const editorTheme = {
  currentLine: { bg: undefined as string | undefined },
  otherLine: {},
  selection: { bg: "#333355" },
  cursor: { bg: "#aaaaaa", fg: "#000000" },
  autocomplete: {
    selectedBg: "#333355",
    selectedFg: "#ffffff",
    normalBg: undefined as string | undefined,
    normalFg: undefined as string | undefined,
  },
}

const tabTheme: TabBarTheme = {
  label: (t) => t,
  activeTab: (t) => `\x1b[1m\x1b[36m${t}\x1b[0m`,
  inactiveTab: (t) => `\x1b[2m${t}\x1b[0m`,
  hint: (t) => `\x1b[2m${t}\x1b[0m`,
}

export async function runApp() {
  const gw = new GatewayClient()
  let state = initialState()
  let activeTab: TabId = "chat"
  let panelCache = new Map<TabId, string[]>()

  const terminal = new ProcessTerminal()
  const tui = new TUI(terminal)

  const tabs: Tab[] = TOOLBAR.map((t) => ({
    id: t.id,
    label: t.label,
    short: t.short,
  }))
  const tabBar = new TabBar("meshina", tabs, tabTheme, 0)
  tabBar.showHint = true

  const body = new LineBox()
  const footer = new FooterView()
  const editor = new Editor(editorTheme as never)
  const help = new Text("Alt+←/→ tabs · /quit · /interrupt · toolbar = Herm chrome over gateway")

  const chatLines = () => state.segments.map(formatSegment)

  const paintBody = () => {
    if (activeTab === "chat") body.set(chatLines())
    else body.set(panelCache.get(activeTab) ?? [`Loading ${activeTab}…`])
    footer.set(state)
    tui.requestRender()
  }

  const refreshPanel = async (id: TabId) => {
    if (id === "chat") {
      paintBody()
      return
    }
    const lines = await loadPanel(gw, id)
    panelCache.set(id, lines)
    if (activeTab === id) paintBody()
  }

  tabBar.onTabChange = (tab) => {
    activeTab = tab.id as TabId
    if (activeTab !== "chat" && !panelCache.has(activeTab)) {
      body.set([`Loading ${activeTab}…`])
      tui.requestRender()
      void refreshPanel(activeTab)
    } else {
      paintBody()
    }
  }

  gw.onEvent((ev) => {
    state = applyEvent(state, ev)
    if (activeTab === "chat") paintBody()
    else {
      footer.set(state)
      tui.requestRender()
    }
  })

  gw.start()

  tui.addChild(tabBar)
  tui.addChild(help)
  tui.addChild(new Text("─".repeat(48)))
  tui.addChild(body)
  tui.addChild(new Text("─".repeat(48)))
  tui.addChild(footer)
  tui.addChild(new Text(""))
  tui.addChild(editor)

  await new Promise((r) => setTimeout(r, 400))
  try {
    const created = await gw.request<SessionCreateResponse>("session.create", {})
    gw.setSession(created.session_id)
    if (created.info) {
      state = applyEvent(state, { type: "session.info", payload: created.info })
    }
  } catch (e) {
    state = applyEvent(state, {
      type: "error",
      payload: { message: e instanceof Error ? e.message : String(e) },
    })
  }
  paintBody()

  editor.onSubmit = (text: string) => {
    const t = text.trim()
    if (!t) return
    if (t === "/quit" || t === "/exit") {
      gw.kill()
      tui.stop()
      process.exit(0)
    }
    if (t === "/interrupt") {
      void gw.request("session.interrupt", {}).catch(() => {})
      return
    }
    if (t === "/refresh") {
      panelCache.delete(activeTab)
      void refreshPanel(activeTab)
      return
    }
    // slash → tab jump (Herm TAB_SLASH lite)
    if (t.startsWith("/") && !t.includes(" ")) {
      const name = t.slice(1).toLowerCase()
      const hit = TOOLBAR.find((x) => x.id === name || x.label.toLowerCase() === name)
      if (hit) {
        const idx = TOOLBAR.findIndex((x) => x.id === hit.id)
        tabBar.setActiveIndex(idx)
        activeTab = hit.id
        void refreshPanel(hit.id)
        return
      }
    }

    // Always route prompts to chat
    if (activeTab !== "chat") {
      tabBar.setActiveIndex(0)
      activeTab = "chat"
    }
    state = pushUser(state, t)
    paintBody()
    void gw.request("prompt.submit", { text: t }).catch((err) => {
      state = applyEvent(state, {
        type: "error",
        payload: { message: err instanceof Error ? err.message : String(err) },
      })
      paintBody()
    })
  }

  const shutdown = () => {
    gw.kill()
    tui.stop()
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)

  tui.start()
}
