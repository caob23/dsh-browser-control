/**
 * Local WebSocket+HTTP bridge between one browser extension and dsh. The
 * extension connects OUT to `ws://127.0.0.1:<port>/ws?token=...`, so no
 * native-messaging host or registry setup exists; dsh drives commands through
 * {@link BridgeServer.execute} and reads link state through {@link BridgeServer.status}.
 * A small HTTP face (`/api/status`, `/api/command`, `/api/cleanup`, `/`) keeps
 * the bridge usable from curl while the server runs.
 *
 * Wire protocol (text frames, one JSON object each):
 * - extension → server: `{type:'hello',…}`, `{type:'pong',t}`, `{type:'result',id,ok,result?|error}`
 * - server → extension: `{type:'ping',t}`, `{type:'command',id,command,params}`
 *
 * Command names (sent in `command`) include: `ping`, `browser.info`, `tabs.list/open/close/activate`,
 * `nav`, `eval`, `content`, `find`, `click`, `input`, `press`, `scroll`, `snapshot`, `screenshot`,
 * `wait`, `dialog`, `console.log`, `network.log`, `network.clear`, `pdf`, `emulate`.
 * @module @deepseek-ai/dsh-browser-bridge/server
 */

import http from 'node:http'
import type net from 'node:net'
import { randomUUID, createHash } from 'node:crypto'
import { mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { encodeCloseFrame, encodeControlFrame, encodeTextFrame, FrameReader } from './ws.ts'

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
/** Per-command ceiling when the caller passes none. */
export const DEFAULT_COMMAND_TIMEOUT_MS = 60_000
/** Hard ceiling accepted from callers; longer waits cannot be expressed. */
export const MAX_COMMAND_TIMEOUT_MS = 300_000
const MAX_HTTP_BODY_BYTES = 2 * 1024 * 1024

/** Identity the extension announces right after the handshake completes. */
export interface BridgeHello {
  readonly client: string
  readonly version: string
  readonly browser: { readonly name: string; readonly version: string; readonly ua: string }
}

/** Snapshot of the link and in-flight work, served verbatim on `/api/status`. */
export interface BridgeServerStatus {
  readonly listening: boolean
  readonly port: number | undefined
  readonly extensionConnected: boolean
  readonly connectedAt: string | undefined
  readonly hello: BridgeHello | undefined
  readonly pendingCommands: number
  readonly lastError: string | undefined
}

/** Caller controls for one {@link BridgeServer.execute} round-trip. */
export interface BridgeExecuteOptions {
  /** Fail the command after this many milliseconds; defaults to 60s, capped at 300s. */
  readonly timeoutMs?: number
  /** Cancellation from the tool execution; aborting fails the in-flight command. */
  readonly signal?: AbortSignal
}

/** What {@link BridgeServer.cleanup} removed. */
export interface CleanupResult {
  /** Files deleted directly inside the screenshots directory. */
  readonly shotsRemoved: number
  /** Scratch files deleted (agent temp scripts/artifacts matched by convention). */
  readonly scratchRemoved: readonly string[]
}

interface PendingEntry {
  readonly command: string
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
  onAbort?: () => void
}

export interface BridgeServerOptions {
  readonly port: number
  readonly token: string
  /** Directory whose direct contents `cleanup()` clears; created on demand. */
  readonly shotsDir: string
  /** Directory scanned for agent scratch files by `cleanup()`; defaults to the process working directory. */
  readonly scratchDir?: string
  /** Optional line logger for lifecycle diagnostics. */
  readonly log?: (line: string) => void
}

/** Agent scratch-file convention: `__name.mjs`-style temp artifacts at the top level only. */
const SCRATCH_FILE_PATTERN = /^__[^/\\]+\.(mjs|cjs|js|png|jpg|jpeg)$/i

/**
 * Clear the screenshots directory and delete agent scratch files. Only the
 * top level of each location is touched; nested trees stay untouched.
 * @param options - `shotsDir` is cleared of direct file children; `scratchDir`
 *   defaults to the process working directory and loses only scratch-named files.
 * @returns counts and names of what was removed.
 */
export async function cleanupArtifacts(options: { shotsDir: string; scratchDir?: string }): Promise<CleanupResult> {
	await mkdir(options.shotsDir, { recursive: true })
	const shotsEntries = await readdir(options.shotsDir, { withFileTypes: true })
	let shotsRemoved = 0
	for (const entry of shotsEntries) {
		if (!entry.isFile()) continue
		await rm(path.join(options.shotsDir, entry.name))
		shotsRemoved += 1
	}
	const scratchDir = options.scratchDir ?? process.cwd()
	const scratchEntries = await readdir(scratchDir, { withFileTypes: true }).catch(() => [])
	const scratchRemoved: string[] = []
	for (const entry of scratchEntries) {
		if (!entry.isFile() || !SCRATCH_FILE_PATTERN.test(entry.name)) continue
		await rm(path.join(scratchDir, entry.name))
		scratchRemoved.push(entry.name)
	}
	return { shotsRemoved, scratchRemoved }
}

/**
 * One live bridge endpoint. Start/stop may cycle repeatedly on one instance;
 * a fresh listener is built per start so a changed config reuses the class
 * without re-allocation concerns. Exactly one extension link is held at a
 * time; a newer WebSocket replaces the older one.
 */
export class BridgeServer {
  private readonly options: BridgeServerOptions
  private httpServer: http.Server | undefined
  private clientSocket: net.Socket | undefined
  private hello: BridgeHello | undefined
  private connectedAt: Date | undefined
  private readonly pending = new Map<string, PendingEntry>()
  private lastError: string | undefined
  private continuationRemainder = ''
  private continuationOpen = false

  constructor(options: BridgeServerOptions) {
    this.options = options
  }

  /** Current link state, also served verbatim as `/api/status`. */
  get status(): BridgeServerStatus {
    return {
      listening: this.httpServer !== undefined,
      port: this.httpServer !== undefined ? this.options.port : undefined,
      extensionConnected: this.clientSocket !== undefined,
      connectedAt: this.connectedAt?.toISOString(),
      hello: this.hello,
      pendingCommands: this.pending.size,
      lastError: this.lastError,
    }
  }

  /** Bind `127.0.0.1:<port>` and start accepting the extension plus HTTP calls. */
  async start(): Promise<void> {
    if (this.httpServer !== undefined) return
    const server = http.createServer((req, res) => {
      try {
        this.handleHttp(req, res)
      } catch (error) {
        this.log(`http handler failed: ${errorMessage(error)}`)
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, error: 'internal error' }))
      }
    })
    server.on('upgrade', (req, socket) => {
      try {
        this.handleUpgrade(req, socket as net.Socket)
      } catch (error) {
        this.log(`upgrade failed: ${errorMessage(error)}`)
        socket.destroy()
      }
    })
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        server.off('listening', onListening)
        this.lastError = errorMessage(error)
        reject(error)
      }
      const onListening = (): void => {
        server.off('error', onError)
        resolve()
      }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(this.options.port, '127.0.0.1')
    })
    this.httpServer = server
    this.log(`listening on ws://127.0.0.1:${this.options.port}/ws`)
  }

  /** Close the extension link, fail every pending command, and release the port. Idempotent. */
  async stop(): Promise<void> {
    const server = this.httpServer
    if (server === undefined) return
    this.httpServer = undefined
    this.closeClientSocket(1001, 'server stopping')
    this.failAllPending(new Error('browser-bridge stopped'))
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
    this.log('stopped')
  }

  /**
   * Send one command to the connected extension and await its result.
   * Throws while no extension is linked; the rejection message names the fix.
   */
  async execute(command: string, params: Record<string, unknown>, options: BridgeExecuteOptions = {}): Promise<unknown> {
    const socket = this.clientSocket
    if (socket === undefined) {
      throw new Error('no browser extension connected — open the browser that has the DSH Browser Control extension installed')
    }
    const timeoutMs = Math.min(MAX_COMMAND_TIMEOUT_MS, Math.max(1, options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS))
    const signal = options.signal
    if (signal?.aborted) throw new Error(`browser command cancelled before send: ${command}`)
    const id = randomUUID()
    const entry: PendingEntry = {
      command,
      resolve: () => {},
      reject: () => {},
      timer: setTimeout(() => {
        if (!this.pending.delete(id)) return
        entry.reject(new Error(`browser command timed out after ${timeoutMs}ms: ${command}`))
      }, timeoutMs),
    }
    const result = new Promise<unknown>((resolve, reject) => {
      entry.resolve = resolve
      entry.reject = reject
    })
    if (signal !== undefined) {
      entry.onAbort = (): void => {
        if (!this.pending.delete(id)) return
        entry.reject(new Error(`browser command cancelled: ${command}`))
      }
      signal.addEventListener('abort', entry.onAbort, { once: true })
    }
    this.pending.set(id, entry)
    this.log(`-> ${command} (${id})`)
    socket.write(encodeTextFrame(JSON.stringify({ type: 'command', id, command, params })))
    try {
      return await result
    } finally {
      clearTimeout(entry.timer)
      if (entry.onAbort !== undefined && signal !== undefined) signal.removeEventListener('abort', entry.onAbort)
    }
  }

  /**
   * Delete generated screenshots and agent scratch files via
   * {@link cleanupArtifacts} using this server's configured directories.
   */
  async cleanup(): Promise<CleanupResult> {
    const result = await cleanupArtifacts({
      shotsDir: this.options.shotsDir,
      ...(this.options.scratchDir === undefined ? {} : { scratchDir: this.options.scratchDir }),
    })
    this.log(`cleanup: ${result.shotsRemoved} screenshot(s), ${result.scratchRemoved.length} scratch file(s)`)
    return result
  }

  private log(line: string): void {
    this.options.log?.(line)
  }

  /* ------------------------------------------------------------- HTTP face */

  private handleHttp(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      })
      res.end()
      return
    }
    if (url.pathname === '/api/status' && req.method === 'GET') {
      this.respondJson(res, 200, { ok: true, ...this.status, wsUrl: `ws://127.0.0.1:${this.options.port}/ws`, shotsDir: path.resolve(this.options.shotsDir) })
      return
    }
    if (url.pathname === '/api/cleanup' && req.method === 'POST') {
      void this.cleanup().then(
        (result) => this.respondJson(res, 200, { ok: true, ...result }),
        (error) => this.respondJson(res, 500, { ok: false, error: errorMessage(error) }),
      )
      return
    }
    if (url.pathname === '/api/command' && req.method === 'POST') {
      this.handleCommandRequest(req, res)
      return
    }
    if (url.pathname === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(statusPageHtml(this.options.port))
      return
    }
    this.respondJson(res, 404, { ok: false, error: `no route: ${req.method} ${url.pathname}` })
  }

  private respondJson(res: http.ServerResponse, statusCode: number, body: unknown): void {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    })
    res.end(JSON.stringify(body))
  }

  private handleCommandRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const chunks: Buffer[] = []
    let size = 0
    let aborted = false
    req.on('data', (chunk: Buffer) => {
      if (aborted) return // keep discarding so the client sees the 413 instead of a reset
      size += chunk.length
      if (size > MAX_HTTP_BODY_BYTES) {
        aborted = true
        chunks.length = 0
        this.respondJson(res, 413, { ok: false, error: 'body too large' })
        req.resume()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (aborted) return
      let parsed: { command?: unknown; params?: unknown; timeoutMs?: unknown }
      try {
        parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as typeof parsed
      } catch (error) {
        this.respondJson(res, 400, { ok: false, error: `invalid JSON body: ${errorMessage(error)}` })
        return
      }
      if (typeof parsed.command !== 'string' || parsed.command.length === 0) {
        this.respondJson(res, 400, { ok: false, error: 'body must be {"command": "...", "params": {...}}' })
        return
      }
      const timeoutMs = typeof parsed.timeoutMs === 'number' ? parsed.timeoutMs : undefined
      this.execute(parsed.command, (parsed.params ?? {}) as Record<string, unknown>, timeoutMs === undefined ? {} : { timeoutMs }).then(
        (result) => this.respondJson(res, 200, { ok: true, result }),
        (error) => {
          const message = errorMessage(error)
          const code = message.startsWith('no browser extension') ? 503 : 502
          this.respondJson(res, code, { ok: false, error: message })
        },
      )
    })
  }

  /* ------------------------------------------------------- websocket link */

  private handleUpgrade(req: http.IncomingMessage, socket: net.Socket): void {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname !== '/ws') {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
      socket.destroy()
      return
    }
    if ((url.searchParams.get('token') ?? '') !== this.options.token) {
      this.log('websocket rejected: bad token')
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }
    const key = req.headers['sec-websocket-key']
    if (typeof key !== 'string' || String(req.headers.upgrade ?? '').toLowerCase() !== 'websocket') {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n')
      socket.destroy()
      return
    }
    const accept = createHash('sha1').update(key + WS_GUID).digest('base64')
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n'
      + 'Upgrade: websocket\r\n'
      + 'Connection: Upgrade\r\n'
      + `Sec-WebSocket-Accept: ${accept}\r\n`
      + '\r\n',
    )
    this.closeClientSocket(1000, 'replaced by a newer connection')
    this.clientSocket = socket
    this.hello = undefined
    this.connectedAt = new Date()
    this.continuationRemainder = ''
    this.continuationOpen = false
    this.log(`extension connected from ${socket.remoteAddress}:${socket.remotePort}`)
    const reader = new FrameReader()
    socket.on('data', (chunk: Buffer) => {
      reader.push(chunk)
      try {
        reader.drain((frame) => this.handleFrame(frame))
      } catch (error) {
        this.log(`protocol error: ${errorMessage(error)}`)
        this.lastError = errorMessage(error)
        this.closeClientSocket(1002, 'protocol error')
      }
    })
    socket.on('error', (error) => {
      this.logVerbose(`socket error: ${errorMessage(error)}`)
      this.closeClientSocket(1011, 'server error')
    })
    socket.on('close', () => {
      if (this.clientSocket !== socket) return
      this.closeClientSocket(1000, '')
    })
  }

  private handleFrame(frame: { fin: boolean; opcode: number; payload: Buffer }): void {
    switch (frame.opcode) {
      case 0x1:
      case 0x0:
        this.handleText(frame.payload.toString('utf8'), frame.fin, frame.opcode)
        return
      case 0x8:
        this.closeClientSocket(1000, '')
        return
      case 0x9:
        this.clientSocket?.write(encodeControlFrame(0xA, frame.payload))
        return
      default:
        return // pong or binary: nothing to do
    }
  }

  private handleText(text: string, fin: boolean, opcode: number): void {
    if (opcode === 0x0 && !this.continuationOpen) return // stray continuation
    if (opcode === 0x1) this.continuationRemainder = ''
    this.continuationOpen = opcode === 0x0 || !fin
    this.continuationRemainder += text
    if (!fin) return
    const full = this.continuationRemainder
    this.continuationRemainder = ''
    this.continuationOpen = false
    let msg: { type?: unknown; id?: unknown; ok?: unknown; result?: unknown; error?: unknown; t?: unknown; client?: unknown; version?: unknown; browser?: unknown }
    try {
      msg = JSON.parse(full) as typeof msg
    } catch {
      this.logVerbose('dropped a non-JSON extension message')
      return
    }
    if (msg.type === 'hello') {
      this.hello = {
        client: typeof msg.client === 'string' ? msg.client : 'unknown',
        version: typeof msg.version === 'string' ? msg.version : 'unknown',
        browser: (msg.browser ?? { name: 'unknown', version: 'unknown', ua: '' }) as BridgeHello['browser'],
      }
      this.log(`hello: client=${this.hello.client} v${this.hello.version} browser=${this.hello.browser.name} ${this.hello.browser.version}`)
      return
    }
    if (msg.type === 'pong') return
    if (msg.type === 'result' && typeof msg.id === 'string') {
      const entry = this.pending.get(msg.id)
      if (entry === undefined) {
        this.logVerbose(`result for unknown id ${msg.id}`)
        return
      }
      this.pending.delete(msg.id)
      clearTimeout(entry.timer)
      if (msg.ok === true) entry.resolve(msg.result)
      else entry.reject(new Error(typeof msg.error === 'string' && msg.error.length > 0 ? msg.error : 'unknown extension error'))
    }
  }

  private closeClientSocket(code: number, reason: string): void {
    const socket = this.clientSocket
    if (socket === undefined) return
    this.clientSocket = undefined
    this.hello = undefined
    this.connectedAt = undefined
    this.failAllPending(new Error('the browser extension disconnected mid-command'))
    try {
      socket.write(encodeCloseFrame(code, reason))
      socket.end()
      setTimeout(() => socket.destroy(), 500).unref()
    } catch {
      socket.destroy()
    }
    if (reason.length > 0) this.log(`extension disconnected (${reason})`)
  }

  private failAllPending(error: Error): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer)
      entry.reject(error)
    }
    this.pending.clear()
  }

  private logVerbose(line: string): void {
    // Verbose chatter stays available under the same line logger; lifecycle logs matter most.
    this.options.log?.(line)
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Minimal self-refreshing status page with the cleanup action. */
function statusPageHtml(port: number): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DSH Browser Control — 状态</title>
<style>
  :root{--bg:#0f172a;--card:#1e293b;--border:#334155;--text:#e2e8f0;--dim:#94a3b8;
        --green:#22c55e;--green-bg:rgba(34,197,94,.12);--red:#ef4444;--red-bg:rgba(239,68,68,.10)}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,"Segoe UI","Microsoft YaHei",sans-serif;background:var(--bg);
       color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{background:var(--card);border:1px solid var(--border);border-radius:16px;max-width:440px;width:100%;overflow:hidden}
  .head{padding:20px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px}
  .dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;background:var(--red)}
  .dot.on{background:var(--green);box-shadow:0 0 6px var(--green)}
  .head h1{font-size:15px;font-weight:600}.head small{color:var(--dim);font-size:11px}
  .rows{padding:16px 24px}
  .row{display:flex;justify-content:space-between;align-items:baseline;padding:7px 0;
       border-bottom:1px solid var(--border);font-size:13px}
  .row:last-child{border-bottom:none}
  .row .k{color:var(--dim)}.row .v{font-weight:500;text-align:right;max-width:260px;word-break:break-all}
  .badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600}
  .badge.on{background:var(--green-bg);color:var(--green)}.badge.off{background:var(--red-bg);color:var(--red)}
  .actions{padding:8px 24px;display:flex;gap:8px}
  .btn{padding:7px 14px;border:1px solid var(--border);border-radius:9px;background:var(--card);
       color:var(--text);font-size:12px;cursor:pointer}.btn:hover{background:#334155}
  .btn.danger{border-color:var(--red);color:var(--red)}.btn.danger:hover{background:var(--red-bg)}
  .hint{color:var(--dim);font-size:11px;padding:4px 24px 8px}
  .pre{background:var(--bg);border-top:1px solid var(--border);padding:12px 24px}
  .pre code{color:var(--dim);font-size:11px;white-space:pre-wrap;word-break:break-all}
  .foot{text-align:center;padding:12px;font-size:11px;color:var(--dim)}
</style>
</head>
<body>
<div class="card">
  <div class="head">
    <div class="dot" id="dot"></div>
    <div><h1>DSH Browser Control</h1><small id="sub">加载中…</small></div>
  </div>
  <div class="rows" id="rows"></div>
  <div class="actions">
    <button class="btn" onclick="refresh()">刷新</button>
    <button class="btn danger" id="cleanup">🧹 清理截图 + 脚本草稿</button>
  </div>
  <div class="hint">清理会删除截图目录下的全部文件，以及工作目录顶层的 __ 开头草稿脚本。</div>
  <div class="pre"><code id="raw"> </code></div>
  <div class="foot">DSH Browser Bridge · 127.0.0.1:${port}</div>
</div>
<script>
async function refresh(){
  try{
    const r=await fetch('/api/status');const j=await r.json();
    const connected=j.extensionConnected;
    document.getElementById('dot').className='dot'+(connected?' on':'');
    document.getElementById('sub').textContent=connected
      ?(j.hello?j.hello.client+' '+j.hello.browser.name+' '+j.hello.browser.version:'已连接')
      :'等待浏览器扩展连接…';
    const rows=[
      ['监听端口','<span class="badge on">'+j.port+'</span>'],
      ['扩展状态',connected?'<span class="badge on">已连接</span>':'<span class="badge off">未连接</span>'],
      ['扩展类型',j.hello?(j.hello.client+' v'+j.hello.version):'—'],
      ['浏览器',j.hello?(j.hello.browser.name+' '+j.hello.browser.version):'—'],
      ['等待命令',String(j.pendingCommands??0)],
      ['连接时间',j.connectedAt?new Date(j.connectedAt).toLocaleString():'—'],
      ['截图目录',j.shotsDir||'—'],
    ];
    document.getElementById('rows').innerHTML=rows.map(([k,v])=>'<div class="row"><span class="k">'+k+'</span><span class="v">'+v+'</span></div>').join('');
    document.getElementById('raw').textContent=JSON.stringify(j,null,2);
  }catch(e){document.getElementById('sub').textContent='连接失败: '+e.message}
}
document.getElementById('cleanup').onclick=async()=>{
  if(!confirm('确认清理截图与临时脚本？'))return;
  const r=await fetch('/api/cleanup',{method:'POST'});const j=await r.json();
  alert(j.ok?('已删除 '+j.shotsRemoved+' 个截图，'+j.scratchRemoved.length+' 个草稿'):('失败：'+j.error));
  refresh();
};
refresh();setInterval(refresh,2000);
</script>
</body></html>`;
}
