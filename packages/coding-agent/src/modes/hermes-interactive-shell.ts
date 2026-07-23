// Hermes interactive shell: OMP chrome coat + Hermes gateway brain.
// Product branding is Hermes-only (see hermes-brand.ts).

import { Editor, ProcessTerminal, Text, TUI, type Component } from "@oh-my-pi/pi-tui"
import { HermesGateway, type SessionInfo, type UiEvent, type Usage } from "@meshina/hermes-bridge"
import { getEditorTheme, initTheme, theme } from "./theme/theme"

function shortPath(p: string): string {
  const home = process.env.HOME || ""
  if (home && (p === home || p.startsWith(home + "/"))) return "~" + p.slice(home.length)
  return p
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

type FooterState = {
  cwd: string
  branch?: string
  model?: string
  effort?: string
  profile?: string
  usage?: Usage
  streaming: boolean
}

class Footer implements Component {
  state: FooterState = { cwd: process.cwd(), streaming: false }
  render(width: number): readonly string[] {
    const s = this.state
    let l1 = s.branch ? `${shortPath(s.cwd)} (${s.branch})` : shortPath(s.cwd)
    if (l1.length > width) {
      const h = Math.max(4, Math.floor(width / 2) - 1)
      l1 = `${l1.slice(0, h)}…${l1.slice(-(h - 1))}`
    }
    const left: string[] = []
    if (s.streaming) left.push("●")
    const u = s.usage
    if (u?.input_tokens) left.push(`↑${fmtNum(u.input_tokens)}`)
    if (u?.output_tokens) left.push(`↓${fmtNum(u.output_tokens)}`)
    if (u?.cost_usd) left.push(`$${u.cost_usd.toFixed(3)}`)
    let ctx = "—"
    if (u?.context_percent != null) ctx = `${Math.round(u.context_percent)}%`
    else if (u?.context_used != null && u?.context_max != null)
      ctx = `${fmtNum(u.context_used)}/${fmtNum(u.context_max)}`
    left.push(ctx)
    if (s.profile) left.push(s.profile)
    const leftStr = left.join(" ")
    const model = s.model || "hermes"
    const right = s.effort && s.effort !== "none" ? `${model} • ${s.effort}` : model
    const gap = Math.max(2, width - leftStr.length - right.length)
    const l2 =
      leftStr.length + 2 + right.length > width
        ? `${leftStr.slice(0, Math.max(0, width - right.length - 2))}  ${right}`
        : leftStr + " ".repeat(gap) + right
    return [l1, l2]
  }
}

class LineBox implements Component {
  lines: string[] = []
  set(lines: string[]) {
    this.lines = lines.length > 200 ? lines.slice(-200) : lines
  }
  render(width: number): readonly string[] {
    return this.lines.map((l) => (l.length > width ? l.slice(0, width - 1) + "…" : l))
  }
}

export async function runHermesShell(): Promise<void> {
  await initTheme()

  const gw = new HermesGateway()
  const terminal = new ProcessTerminal()
  const tui = new TUI(terminal)

  const header = new Text(theme.fg("accent", "hermes") + theme.fg("dim", "  ·  agent cockpit"))
  const body = new LineBox()
  const footer = new Footer()
  const editor = new Editor(getEditorTheme())

  let thinkingBuf = ""
  let textBuf = ""
  const toolLines = new Map<string, string>()
  const history: string[] = []

  const paint = () => tui.requestRender()

  const applyInfo = (info: SessionInfo) => {
    footer.state = {
      ...footer.state,
      cwd: info.cwd || footer.state.cwd,
      branch: info.branch ?? footer.state.branch,
      model: info.model ?? footer.state.model,
      effort: info.reasoning_effort ?? footer.state.effort,
      profile: info.profile_name ?? footer.state.profile,
      usage: info.usage ?? footer.state.usage,
      streaming: !!info.running,
    }
    paint()
  }

  const rebuildBody = () => {
    const lines = [...history]
    if (thinkingBuf) lines.push(theme.fg("dim", `⋯ ${thinkingBuf.slice(-240).replace(/\s+/g, " ")}`))
    for (const [, t] of toolLines) lines.push(t)
    if (textBuf) lines.push(textBuf)
    body.set(lines)
    paint()
  }

  gw.onUi((ev: UiEvent) => {
    switch (ev.kind) {
      case "ready":
        history.push(theme.fg("dim", "gateway ready"))
        rebuildBody()
        break
      case "info":
        applyInfo(ev.info)
        if (ev.info.model && !history.some((h) => h.includes("Connected"))) {
          history.push(
            theme.fg(
              "dim",
              `Connected — ${ev.info.model}${ev.info.reasoning_effort ? ` • ${ev.info.reasoning_effort}` : ""}`,
            ),
          )
          rebuildBody()
        }
        break
      case "stderr":
        if (/error|fail|traceback/i.test(ev.line)) {
          history.push(theme.fg("error", ev.line.slice(0, 160)))
          rebuildBody()
        }
        break
      case "user":
        thinkingBuf = ""
        textBuf = ""
        toolLines.clear()
        history.push(`${theme.fg("accent", "❯")} ${ev.text}`)
        footer.state.streaming = true
        rebuildBody()
        break
      case "thinking":
        thinkingBuf = ev.done ? ev.text : thinkingBuf + ev.text
        footer.state.streaming = true
        rebuildBody()
        break
      case "text":
        if (ev.done) {
          if (ev.text) textBuf = ev.text
          if (textBuf) history.push(textBuf)
          thinkingBuf = ""
          textBuf = ""
          toolLines.clear()
        } else {
          textBuf += ev.text
        }
        footer.state.streaming = !ev.done
        rebuildBody()
        break
      case "tool_start": {
        toolLines.set(
          ev.id || ev.name,
          theme.fg("dim", `▸ ${ev.name}${ev.args ? `: ${ev.args.slice(0, 80)}` : ""}`),
        )
        footer.state.streaming = true
        rebuildBody()
        break
      }
      case "tool_end": {
        const line = ev.error
          ? theme.fg("error", `✗ ${ev.name}: ${ev.error.slice(0, 100)}`)
          : theme.fg("dim", `▹ ${ev.name}${ev.summary ? `: ${ev.summary.slice(0, 100)}` : ""}`)
        history.push(line)
        toolLines.delete(ev.id || ev.name)
        rebuildBody()
        break
      }
      case "turn_end":
        footer.state.streaming = false
        if (ev.usage) footer.state.usage = { ...footer.state.usage, ...ev.usage }
        rebuildBody()
        break
      case "error":
        history.push(theme.fg("error", `! ${ev.text}`))
        footer.state.streaming = false
        rebuildBody()
        break
      case "clarify":
        history.push(theme.fg("warning", `? ${ev.question}`))
        if (ev.choices?.length) history.push(theme.fg("dim", `  [${ev.choices.join(" | ")}]`))
        footer.state.streaming = false
        rebuildBody()
        break
      case "approval":
        history.push(theme.fg("warning", `approval: ${ev.description || ev.command}`))
        footer.state.streaming = false
        rebuildBody()
        break
      case "status":
        footer.state.streaming = true
        paint()
        break
      default:
        break
    }
  })

  tui.addChild(header)
  tui.addChild(new Text(theme.fg("dim", "─".repeat(48))))
  tui.addChild(body)
  tui.addChild(new Text(theme.fg("dim", "─".repeat(48))))
  tui.addChild(footer)
  tui.addChild(new Text(""))
  tui.addChild(editor)

  tui.setFocus(editor)
  tui.start()

  try {
    const info = await gw.bootstrap()
    applyInfo(info)
  } catch (e) {
    history.push(theme.fg("error", `bootstrap: ${e instanceof Error ? e.message : String(e)}`))
    rebuildBody()
  }
  tui.setFocus(editor)

  editor.onSubmit = (raw) => {
    const text = raw.trim()
    if (!text) return
    if (text === "/quit" || text === "/exit") {
      gw.kill()
      tui.stop()
      process.exit(0)
    }
    if (text === "/interrupt") {
      void gw.interrupt().catch(() => {})
      return
    }
    void gw.submit(text).catch((e) => {
      history.push(theme.fg("error", e instanceof Error ? e.message : String(e)))
      rebuildBody()
    })
  }

  const shutdown = () => {
    gw.kill()
    tui.stop()
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}
