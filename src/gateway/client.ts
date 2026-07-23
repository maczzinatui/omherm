// Stdio / WebSocket JSON-RPC 2.0 client for Hermes tui_gateway.
// Shape matches the public wire Herm uses; implementation is original to this repo.

import { EventEmitter } from "events"
import { existsSync } from "fs"
import { homedir } from "os"
import { delimiter, resolve } from "path"
import { asGatewayEvent, type GatewayEvent } from "./wire"

const STARTUP_MS = 15_000
const REQUEST_MS = 120_000
const LOG_PREVIEW = 240

type Pending = {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
}

export function hermesAgentRoot(): string {
  if (process.env.HERMES_AGENT_ROOT) return process.env.HERMES_AGENT_ROOT
  const home = process.env.HOME || homedir()
  const homePath = `${home}/.hermes/hermes-agent`
  if (existsSync(homePath)) return homePath
  const fhs = "/usr/local/lib/hermes-agent"
  if (existsSync(fhs)) return fhs
  return homePath
}

export function gatewayUrl(): string | null {
  return (
    process.env.HERMES_TUI_GATEWAY_URL?.trim() ||
    process.env.HERM_GATEWAY_URL?.trim() ||
    null
  )
}

export function websocketUrl(raw: string): string {
  const url = new URL(raw)
  if (url.protocol === "http:") url.protocol = "ws:"
  else if (url.protocol === "https:") url.protocol = "wss:"
  else if (url.protocol !== "ws:" && url.protocol !== "wss:")
    throw new Error(`unsupported gateway URL protocol: ${url.protocol}`)
  const prefix = url.pathname.replace(/\/+$/, "")
  if (!prefix.endsWith("/api/ws")) url.pathname = `${prefix}/api/ws`
  return url.toString()
}

function python(root: string): string {
  const env = process.env.HERMES_PYTHON?.trim()
  if (env) return env
  const venv = process.env.VIRTUAL_ENV?.trim()
  const paths = [
    venv && resolve(venv, "bin", "python"),
    venv && resolve(venv, "bin", "python3"),
    resolve(root, "venv", "bin", "python"),
    resolve(root, "venv", "bin", "python3"),
    resolve(root, ".venv", "bin", "python"),
    resolve(root, ".venv", "bin", "python3"),
  ]
  return paths.find((p) => p && existsSync(p)) || "python3"
}

function textOf(raw: unknown): string | null {
  if (typeof raw === "string") return raw
  if (raw instanceof ArrayBuffer) return new TextDecoder().decode(raw)
  if (ArrayBuffer.isView(raw)) {
    const view = raw as ArrayBufferView
    return new TextDecoder().decode(
      new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
    )
  }
  return null
}

async function readLines(
  stream: ReadableStream<Uint8Array> | null | undefined,
  cb: (line: string) => void,
) {
  if (!stream || typeof stream.getReader !== "function") return
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

export class GatewayClient extends EventEmitter {
  private proc: ReturnType<typeof Bun.spawn> | null = null
  private ws: WebSocket | null = null
  private link: Promise<void> | null = null
  private target: string | null = null
  private id = 0
  private pending = new Map<string, Pending>()
  private buf: GatewayEvent[] = []
  private ok = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private sub = false
  private sid: string | null = null

  setSession(sid: string) {
    this.sid = sid
  }

  get sessionId() {
    return this.sid
  }

  get ready() {
    return this.ok
  }

  onEvent(cb: (ev: GatewayEvent) => void): () => void {
    this.sub = true
    for (const ev of this.buf.splice(0)) cb(ev)
    const handler = (ev: GatewayEvent) => cb(ev)
    this.on("event", handler)
    return () => {
      this.off("event", handler)
    }
  }

  private push(ev: GatewayEvent) {
    if (ev.type === "gateway.ready") {
      this.ok = true
      if (this.timer) {
        clearTimeout(this.timer)
        this.timer = null
      }
    }
    if (this.sub) this.emit("event", ev)
    else this.buf.push(ev)
  }

  private dispatch(msg: Record<string, unknown>) {
    const id = msg.id as string | undefined
    const p = id ? this.pending.get(id) : undefined
    if (p) {
      this.pending.delete(id!)
      if (msg.error) {
        const err = msg.error as { message?: unknown }
        p.reject(new Error(typeof err?.message === "string" ? err.message : "request failed"))
      } else {
        p.resolve(msg.result)
      }
      return
    }
    if (msg.method === "event") {
      const ev = asGatewayEvent(msg.params)
      if (ev) this.push(ev)
    }
  }

  private fail(err: Error) {
    for (const p of Array.from(this.pending.values())) p.reject(err)
    this.pending.clear()
  }

  private connectWs(raw: string) {
    const cwd = process.env.HERMES_CWD || process.cwd()
    let url: string
    try {
      url = websocketUrl(raw)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.push({ type: "gateway.stderr", payload: { line: message } })
      return
    }
    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.push({ type: "gateway.stderr", payload: { line: message } })
      return
    }
    this.target = raw
    this.ws = ws
    let settled = false
    this.link = new Promise<void>((resolve, reject) => {
      ws.addEventListener(
        "open",
        () => {
          if (settled) return
          settled = true
          resolve()
        },
        { once: true },
      )
      ws.addEventListener(
        "error",
        () => {
          if (settled) return
          settled = true
          reject(new Error("gateway websocket connection failed"))
          try {
            ws.close()
          } catch {
            /* */
          }
        },
        { once: true },
      )
    })
    this.link.catch(() => {})

    this.timer = setTimeout(() => {
      if (this.ok || this.ws !== ws) return
      this.push({ type: "gateway.start_timeout", payload: { cwd, python: "websocket" } })
      this.ws = null
      this.link = null
      this.fail(new Error("gateway websocket startup timeout"))
      try {
        ws.close()
      } catch {
        /* */
      }
    }, STARTUP_MS)

    ws.addEventListener("message", (event) => {
      if (this.ws !== ws) return
      const rawMsg = textOf(event.data)
      if (!rawMsg) return
      try {
        this.dispatch(JSON.parse(rawMsg))
      } catch {
        const preview = rawMsg.trim().slice(0, LOG_PREVIEW) || "(empty)"
        this.push({ type: "gateway.protocol_error", payload: { preview } })
      }
    })
    ws.addEventListener("close", () => {
      if (this.ws !== ws) return
      if (this.timer) {
        clearTimeout(this.timer)
        this.timer = null
      }
      this.ws = null
      this.link = null
      this.fail(new Error("gateway websocket closed"))
    })
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
    this.buf = []

    if (this.proc) {
      try {
        this.proc.kill()
      } catch {
        /* */
      }
      this.proc = null
      this.fail(new Error("gateway restarted"))
    }
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        /* */
      }
      this.ws = null
      this.link = null
      this.target = null
    }
    if (this.timer) clearTimeout(this.timer)

    if (raw) {
      this.connectWs(raw)
      return
    }

    this.timer = setTimeout(() => {
      if (this.ok) return
      this.push({ type: "gateway.start_timeout", payload: { cwd, python: bin } })
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
        this.push({ type: "gateway.protocol_error", payload: { preview: line.slice(0, LOG_PREVIEW) } })
      }
    })
    void readLines(this.proc.stderr as ReadableStream<Uint8Array> | null, (line) => {
      this.push({ type: "gateway.stderr", payload: { line } })
    })
    void this.proc.exited.then((code) => {
      this.fail(new Error(`gateway exited${code === null ? "" : ` (${code})`}`))
      this.emit("exit", code)
    })
  }

  request<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const raw = gatewayUrl()
    if (raw) return this.remote<T>(raw, method, params)
    if (!this.proc || this.proc.exitCode !== null) this.start()
    const stdin = this.proc?.stdin
    if (!stdin || typeof stdin === "number") return Promise.reject(new Error("gateway not running"))

    const rid = `r${++this.id}`
    const merged =
      this.sid && params.session_id === undefined ? { session_id: this.sid, ...params } : params
    const writer = stdin as { write(data: string | Uint8Array): number }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pending.delete(rid)) reject(new Error(`timeout: ${method}`))
      }, REQUEST_MS)
      this.pending.set(rid, {
        reject: (e) => {
          clearTimeout(timeout)
          reject(e)
        },
        resolve: (v) => {
          clearTimeout(timeout)
          resolve(v as T)
        },
      })
      try {
        writer.write(JSON.stringify({ jsonrpc: "2.0", id: rid, method, params: merged }) + "\n")
      } catch (e) {
        clearTimeout(timeout)
        this.pending.delete(rid)
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    })
  }

  private remote<T>(raw: string, method: string, params: Record<string, unknown>): Promise<T> {
    try {
      websocketUrl(raw)
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error(String(err)))
    }
    if (this.target !== raw || !this.ws || this.ws.readyState === WebSocket.CLOSING || this.ws.readyState === WebSocket.CLOSED)
      this.start()

    const rid = `r${++this.id}`
    const merged =
      this.sid && params.session_id === undefined ? { session_id: this.sid, ...params } : params

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pending.delete(rid)) reject(new Error(`timeout: ${method}`))
      }, REQUEST_MS)
      this.pending.set(rid, {
        reject: (e) => {
          clearTimeout(timeout)
          reject(e)
        },
        resolve: (v) => {
          clearTimeout(timeout)
          resolve(v as T)
        },
      })
      const send = async () => {
        try {
          if (this.ws?.readyState === WebSocket.CONNECTING) await this.link
          if (!this.pending.has(rid)) return
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
            throw new Error(`gateway not connected: ${method}`)
          this.ws.send(JSON.stringify({ jsonrpc: "2.0", id: rid, method, params: merged }))
        } catch (err) {
          clearTimeout(timeout)
          if (this.pending.delete(rid))
            reject(err instanceof Error ? err : new Error(String(err)))
        }
      }
      void send()
    })
  }

  kill() {
    try {
      this.proc?.kill()
    } catch {
      /* */
    }
    this.proc = null
    const ws = this.ws
    this.ws = null
    this.link = null
    this.target = null
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.fail(new Error("gateway closed"))
    try {
      ws?.close()
    } catch {
      /* */
    }
  }
}
