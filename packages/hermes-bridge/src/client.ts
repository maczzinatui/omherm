// Stdio JSON-RPC client for Hermes tui_gateway.

import { EventEmitter } from "node:events"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { delimiter, resolve } from "node:path"
import { asGatewayEvent, mapGatewayToUi, type GatewayEvent, type SessionCreateResponse, type SessionInfo, type UiEvent } from "./types.ts"

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

  async submit(text: string): Promise<void> {
    this.emitUi({ kind: "user", text })
    await this.request("prompt.submit", { text })
  }

  async interrupt(): Promise<void> {
    await this.request("session.interrupt", {})
  }

  async respondClarify(requestId: string, answer: string): Promise<void> {
    await this.request("clarify.respond", { request_id: requestId, answer })
  }

  async respondApproval(allow: boolean): Promise<void> {
    await this.request("approval.respond", { allow })
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
