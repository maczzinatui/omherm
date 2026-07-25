// Stdio JSON-RPC client for Hermes tui_gateway.

import { EventEmitter } from "node:events"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { delimiter, resolve } from "node:path"
import { asGatewayEvent, mapGatewayToUi, type GatewayEvent, type SessionCreateResponse, type SessionInfo, type UiEvent } from "./types.ts"
import type { MessageImage } from "./cockpit-session.ts"

const STARTUP_MS = 15_000
const REQUEST_MS = 120_000

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void }

export function hermesAgentRoot(): string {
  if (process.env.HERMES_AGENT_ROOT) return process.env.HERMES_AGENT_ROOT
  const home = process.env.HOME || homedir()
  const p = `${home}/.hermes/hermes-agent`
  if (existsSync(p)) return p
  return p
}

export function gatewayUrl(): string | null {
  return process.env.HERMES_TUI_GATEWAY_URL?.trim() || process.env.HERM_GATEWAY_URL?.trim() || null
}

function python(root: string): string {
  const env = process.env.HERMES_PYTHON?.trim()
  if (env) return env
  const candidates = [
    resolve(root, "venv/bin/python"),
    resolve(root, "venv/bin/python3"),
    resolve(root, ".venv/bin/python"),
  ]
  return candidates.find((c) => existsSync(c)) || "python3"
}

function textOf(raw: unknown): string | null {
  if (typeof raw === "string") return raw
  if (raw instanceof ArrayBuffer) return new TextDecoder().decode(raw)
  if (ArrayBuffer.isView(raw)) {
    const v = raw as ArrayBufferView
    return new TextDecoder().decode(new Uint8Array(v.buffer, v.byteOffset, v.byteLength))
  }
  return null
}

async function readLines(stream: ReadableStream<Uint8Array> | null | undefined, cb: (line: string) => void) {
  if (!stream || typeof (stream as ReadableStream<Uint8Array>).getReader !== "function") return
  const reader = stream.getReader()
  const dec = new TextDecoder()
  let buf = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const parts = buf.split("\n")
      buf = parts.pop() || ""
      for (const line of parts) if (line) cb(line)
    }
    if (buf.trim()) cb(buf)
  } catch {
    /* closed */
  }
}

export class HermesGateway extends EventEmitter {
  private proc: ReturnType<typeof Bun.spawn> | null = null
  private ws: WebSocket | null = null
  private link: Promise<void> | null = null
  private target: string | null = null
  private id = 0
  private pending = new Map<string, Pending>()
  private ok = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private sid: string | null = null
  private info: SessionInfo = {}
  private uiListeners = new Set<(ev: UiEvent) => void>()

  get sessionId() {
    return this.sid
  }
  get sessionInfo() {
    return this.info
  }
  get ready() {
    return this.ok
  }

  onUi(cb: (ev: UiEvent) => void): () => void {
    this.uiListeners.add(cb)
    return () => this.uiListeners.delete(cb)
  }

  private emitUi(ev: UiEvent) {
    if (ev.kind === "info") this.info = { ...this.info, ...ev.info }
    if (ev.kind === "turn_end" && ev.usage) {
      const u = ev.usage
      const mapped = {
        input_tokens: u.input_tokens,
        output_tokens: u.output_tokens,
        total_tokens: u.total_tokens ?? ((u.input_tokens ?? 0) + (u.output_tokens ?? 0) || undefined),
        cost_usd: u.cost_usd,
        context_used: u.context_used,
        context_max: u.context_max,
        context_percent: u.context_percent,
        compressions: u.compressions,
      }
      const cleaned = Object.fromEntries(
        Object.entries(mapped).filter(([, v]) => v !== undefined && v !== null),
      ) as SessionInfo["usage"]
      if (cleaned && Object.keys(cleaned).length) {
        this.info = { ...this.info, usage: { ...this.info.usage, ...cleaned } }
      }
    }
    for (const cb of this.uiListeners) cb(ev)
  }

  private pushGw(ev: GatewayEvent) {
    if (ev.type === "gateway.ready") {
      this.ok = true
      if (this.timer) {
        clearTimeout(this.timer)
        this.timer = null
      }
    }
    const mapped = mapGatewayToUi(ev)
    if (!mapped) return
    if (Array.isArray(mapped)) for (const m of mapped) this.emitUi(m)
    else this.emitUi(mapped)
  }

  private dispatch(msg: Record<string, unknown>) {
    const id = msg.id as string | undefined
    const p = id ? this.pending.get(id) : undefined
    if (p) {
      this.pending.delete(id!)
      if (msg.error) {
        const err = msg.error as { message?: unknown }
        p.reject(new Error(typeof err?.message === "string" ? err.message : "request failed"))
      } else p.resolve(msg.result)
      return
    }
    if (msg.method === "event") {
      const ev = asGatewayEvent(msg.params)
      if (ev) this.pushGw(ev)
    }
  }

  private fail(err: Error) {
    for (const p of Array.from(this.pending.values())) p.reject(err)
    this.pending.clear()
  }

  start() {
    const raw = gatewayUrl()
    const root = hermesAgentRoot()
    const bin = python(root)
    const cwd = process.env.HERMES_CWD || process.cwd()
    const env = { ...process.env } as Record<string, string>
    if (!env.TERMINAL_CWD) env.TERMINAL_CWD = cwd
    const pp = env.PYTHONPATH?.trim()
    env.PYTHONPATH = pp ? `${root}${delimiter}${pp}` : root
    env.HERMES_PYTHON_SRC_ROOT = root
    this.ok = false

    if (this.proc) {
      try {
        this.proc.kill()
      } catch {
        /* */
      }
      this.proc = null
    }
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        /* */
      }
      this.ws = null
    }
    if (this.timer) clearTimeout(this.timer)

    if (raw) {
      this.connectWs(raw, cwd)
      return
    }

    this.timer = setTimeout(() => {
      if (this.ok) return
      this.pushGw({ type: "gateway.start_timeout", payload: { cwd, python: bin } })
      try {
        this.proc?.kill()
      } catch {
        /* */
      }
    }, STARTUP_MS)

    this.proc = Bun.spawn([bin, "-u", "-m", "tui_gateway.entry"], {
      cwd,
      env,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    })
    void readLines(this.proc.stdout as ReadableStream<Uint8Array> | null, (line) => {
      try {
        this.dispatch(JSON.parse(line))
      } catch {
        this.pushGw({ type: "gateway.protocol_error", payload: { preview: line.slice(0, 200) } })
      }
    })
    void readLines(this.proc.stderr as ReadableStream<Uint8Array> | null, (line) => {
      this.pushGw({ type: "gateway.stderr", payload: { line } })
    })
    void this.proc.exited.then((code) => {
      this.fail(new Error(`gateway exited${code == null ? "" : ` (${code})`}`))
      this.emit("exit", code)
    })
  }

  private connectWs(raw: string, cwd: string) {
    let url: URL
    try {
      url = new URL(raw)
      if (url.protocol === "http:") url.protocol = "ws:"
      if (url.protocol === "https:") url.protocol = "wss:"
      const prefix = url.pathname.replace(/\/+$/, "")
      if (!prefix.endsWith("/api/ws")) url.pathname = `${prefix}/api/ws`
    } catch (e) {
      this.pushGw({ type: "gateway.stderr", payload: { line: String(e) } })
      return
    }
    const ws = new WebSocket(url.toString())
    this.ws = ws
    this.target = raw
    this.link = new Promise((resolve, reject) => {
      ws.addEventListener("open", () => resolve(), { once: true })
      ws.addEventListener("error", () => reject(new Error("ws failed")), { once: true })
    })
    this.link.catch(() => {})
    this.timer = setTimeout(() => {
      if (this.ok) return
      this.pushGw({ type: "gateway.start_timeout", payload: { cwd, python: "websocket" } })
      try {
        ws.close()
      } catch {
        /* */
      }
    }, STARTUP_MS)
    ws.addEventListener("message", (ev) => {
      const t = textOf(ev.data)
      if (!t) return
      try {
        this.dispatch(JSON.parse(t))
      } catch {
        this.pushGw({ type: "gateway.protocol_error", payload: { preview: t.slice(0, 200) } })
      }
    })
    ws.addEventListener("close", () => {
      this.fail(new Error("gateway websocket closed"))
    })
  }

  request<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!this.proc && !this.ws) this.start()
    const rid = `r${++this.id}`
    const merged = this.sid && params.session_id === undefined ? { session_id: this.sid, ...params } : params
    const frame = JSON.stringify({ jsonrpc: "2.0", id: rid, method, params: merged })

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pending.delete(rid)) reject(new Error(`timeout: ${method}`))
      }, REQUEST_MS)
      this.pending.set(rid, {
        resolve: (v) => {
          clearTimeout(timeout)
          resolve(v as T)
        },
        reject: (e) => {
          clearTimeout(timeout)
          reject(e)
        },
      })
      try {
        if (this.ws) {
          void (async () => {
            if (this.ws?.readyState === WebSocket.CONNECTING) await this.link
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error("ws not open")
            this.ws.send(frame)
          })().catch((e) => {
            clearTimeout(timeout)
            this.pending.delete(rid)
            reject(e instanceof Error ? e : new Error(String(e)))
          })
        } else {
          const stdin = this.proc?.stdin as { write(d: string): number } | undefined
          if (!stdin) throw new Error("gateway not running")
          stdin.write(frame + "\n")
        }
      } catch (e) {
        clearTimeout(timeout)
        this.pending.delete(rid)
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    })
  }

  async bootstrap(): Promise<SessionInfo> {
    this.start()
    await new Promise((r) => setTimeout(r, 400))
    const created = await this.request<SessionCreateResponse>("session.create", {
      cwd: process.env.HERMES_CWD || process.cwd(),
    })
    this.sid = created.session_id
    if (created.info) {
      this.info = created.info
      this.emitUi({ kind: "info", info: created.info })
    }
    return this.info
  }

  async submit(text: string, images?: readonly MessageImage[]): Promise<void> {
    this.emitUi({ kind: "user", text })
    const params: Record<string, unknown> = { text }
    if (images && images.length) params.images = images
    await this.request("prompt.submit", params)
  }

  async interrupt(): Promise<void> {
    await this.request("session.interrupt", {})
  }

  async steer(text: string, images?: readonly MessageImage[]): Promise<{ mode: "steer" | "unsupported" }> {
    const trimmed = text.trim()
    if (!trimmed) return { mode: "unsupported" }
    const params: Record<string, unknown> = { text: trimmed }
    if (images && images.length) params.images = images
    try {
      await this.request("session.steer", params)
      return { mode: "steer" }
    } catch {
      return { mode: "unsupported" }
    }
  }

  /**
   * Refresh footer-facing session fields.
   * Note: `session.info` is a gateway *event*, not an RPC. Pull usage via
   * `session.usage` and optional config keys via `config.get`.
   */
  async refreshInfo(): Promise<SessionInfo> {
    try {
      const usage = await this.request<Record<string, unknown>>("session.usage", {})
      if (usage && typeof usage === "object") {
        const mapped: SessionInfo["usage"] = {
          input_tokens: num(usage.input ?? usage.input_tokens),
          output_tokens: num(usage.output ?? usage.output_tokens),
          total_tokens: num(usage.total ?? usage.total_tokens),
          context_used: num(usage.context_used),
          context_max: num(usage.context_max),
          context_percent: num(usage.context_percent),
          cost_usd: num(usage.cost_usd),
          compressions: num(usage.compressions),
        }
        this.info = { ...this.info, usage: { ...this.info.usage, ...stripUndef(mapped) } }
      }
    } catch {
      /* usage optional */
    }
    // Gateway config.get takes a singular `key` (not `keys: []`). Reasoning
    // is key "reasoning" and returns { value, display } — and prefers the
    // live session agent.reasoning_config when session_id is passed.
    try {
      const reasoning = await this.request<Record<string, unknown>>("config.get", {
        key: "reasoning",
        session_id: this.sessionId,
      })
      if (reasoning && typeof reasoning === "object") {
        const v = reasoning.value
        if (typeof v === "string" && v.trim()) {
          this.info = { ...this.info, reasoning_effort: v.trim() }
        }
      }
    } catch {
      /* config optional — keep last session.info push */
    }
    try {
      const provider = await this.request<Record<string, unknown>>("config.get", {
        key: "provider",
      })
      if (provider && typeof provider === "object") {
        const patch: SessionInfo = {}
        if (typeof provider.model === "string") patch.model = provider.model
        if (typeof provider.provider === "string") patch.provider = provider.provider
        if (Object.keys(patch).length) this.info = { ...this.info, ...patch }
      }
    } catch {
      /* optional */
    }
    this.emitUi({ kind: "info", info: this.info })
    return this.info
  }

  async respondClarify(requestId: string, answer: string): Promise<void> {
    await this.request("clarify.respond", { request_id: requestId, answer })
  }

  /**
   * Gateway approval slot — choice is once|session|always|deny (not a boolean).
   * See hermes-agent tui_gateway approval.respond + resolve_gateway_approval.
   */
  async respondApproval(choice: string, resolveAll = false): Promise<void> {
    await this.request("approval.respond", { choice, all: resolveAll })
  }

  /** Run a Hermes slash command in the live gateway session. Returns pager text. */
  async slashExec(command: string): Promise<{ output: string; warning?: string }> {
    const cmd = command.trim()
    if (!cmd) return { output: "" }
    const full = cmd.startsWith("/") ? cmd : `/${cmd}`
    const res = await this.request<{ output?: string; warning?: string }>("slash.exec", {
      command: full,
    })
    return {
      output: typeof res?.output === "string" ? res.output : "(no output)",
      warning: typeof res?.warning === "string" ? res.warning : undefined,
    }
  }

  /** Hermes session inventory (gateway SoT). */
  async listSessions(limit = 80): Promise<
    Array<{
      id: string
      title: string
      preview: string
      started_at: number
      message_count: number
      source: string
    }>
  > {
    const res = await this.request<{ sessions?: unknown[] }>("session.list", { limit })
    const rows = Array.isArray(res?.sessions) ? res.sessions : []
    return rows
      .map((raw) => {
        const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
        return {
          id: String(s.id ?? ""),
          title: String(s.title ?? ""),
          preview: String(s.preview ?? ""),
          started_at: typeof s.started_at === "number" ? s.started_at : Number(s.started_at) || 0,
          message_count:
            typeof s.message_count === "number" ? s.message_count : Number(s.message_count) || 0,
          source: String(s.source ?? ""),
        }
      })
      .filter((s) => s.id)
  }

  /**
   * Bind this gateway client to a stored Hermes session.
   * Returns display messages when the gateway includes them (for coat paint later).
   */
  async resumeSession(sessionId: string): Promise<{
    session_id: string
    resumed?: string
    messages?: unknown[]
    info?: SessionInfo
    raw: Record<string, unknown>
  }> {
    const id = sessionId.trim()
    if (!id) throw new Error("session_id required")
    const res = await this.request<Record<string, unknown>>("session.resume", {
      session_id: id,
      cols: process.stdout.columns || 80,
    })
    const sid = String(res?.session_id ?? "")
    if (sid) this.sid = sid
    if (res?.info && typeof res.info === "object") {
      this.info = { ...this.info, ...(res.info as SessionInfo) }
      this.emitUi({ kind: "info", info: this.info })
    }
    return {
      session_id: sid || id,
      resumed: res?.resumed != null ? String(res.resumed) : undefined,
      messages: Array.isArray(res?.messages) ? res.messages : undefined,
      info: this.info,
      raw: res || {},
    }
  }

  kill() {
    try {
      this.proc?.kill()
    } catch {
      /* */
    }
    this.proc = null
    try {
      this.ws?.close()
    } catch {
      /* */
    }
    this.ws = null
    this.fail(new Error("gateway closed"))
  }
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v)
  return undefined
}

function stripUndef<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v
  }
  return out
}
