/**
 * Minimal WebSocket client standing in for the extension inside tests: real
 * TCP + RFC 6455 handshake, masked text frames out, parses the server's
 * unmasked text frames, and answers every `command` through a handler.
 * @module tests/helpers/fake-extension
 */

import net from 'node:net'
import { randomUUID } from 'node:crypto'

export interface FakeExtensionCommand {
  readonly id: string
  readonly command: string
  readonly params: Record<string, unknown>
}

/** One scripted extension link. */
export class FakeExtension {
  private socket: net.Socket | undefined
  private buffer: Buffer = Buffer.alloc(0)
  private remainder = ''
  /** Every command the server sent, in order. */
  readonly received: FakeExtensionCommand[] = []
  /** Handler producing the result payload for a command; thrown errors become ok:false. */
  onCommand: (command: FakeExtensionCommand) => unknown = () => ({})
  /** When false, commands are recorded but never answered (timeout/cancel paths). */
  autoReply = true
  /** Resolves after the server accepts the upgrade. Declared first: with
   *  useDefineForClassFields a later bare declaration would reset it. */
  private connectedResolve!: () => void
  private readonly connected = new Promise<void>((resolve) => { this.connectedResolve = resolve })
  /** Resolves when the server closes the TCP link. */
  private closedResolve!: () => void
  private readonly closed = new Promise<void>((resolve) => { this.closedResolve = resolve })

  constructor(private readonly port: number, private readonly token: string) {}

  /** Dial the server, complete the handshake, and start answering commands. */
  async connect(): Promise<void> {
    const key = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '')
    const socket = net.connect(this.port, '127.0.0.1')
    this.socket = socket
    const handshake = [
      `GET /ws?token=${this.token} HTTP/1.1`,
      'Host: 127.0.0.1',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Key: ${key}`,
      'Sec-WebSocket-Version: 13',
      '\r\n',
    ].join('\r\n')
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve)
      socket.once('error', reject)
    })
    await new Promise<void>((resolve, reject) => {
      const onData = (chunk: Buffer): void => {
        const text = chunk.toString('utf8')
        if (!text.startsWith('HTTP/1.1 101')) {
          socket.off('data', onData)
          reject(new Error(`upgrade refused: ${text.split('\r\n')[0]}`))
          return
        }
        socket.off('data', onData)
        socket.on('data', (frame: Buffer) => this.readFrames(frame))
        resolve()
      }
      socket.on('data', onData)
      socket.write(handshake)
    })
    this.connectedResolve()
    this.send({ type: 'hello', client: 'fake-extension', version: '0.0.0', browser: { name: 'TestBrowser', version: '1', ua: 'test' } })
  }

  /** Promise settling once the upgrade is accepted. */
  whenConnected(): Promise<void> {
    return this.connected
  }

  /** Promise settling when the server closes the link. */
  whenClosed(): Promise<void> {
    return this.closed
  }

  /** Send one JSON message as a masked text frame. */
  send(message: Record<string, unknown>): void {
    const socket = this.socket
    if (socket === undefined) throw new Error('fake extension is not connected')
    const payload = Buffer.from(JSON.stringify(message), 'utf8')
    const mask = Buffer.from([0x11, 0x22, 0x33, 0x44])
    let header: Buffer
    if (payload.length < 126) {
      header = Buffer.from([0x81, 0x80 | payload.length])
    } else if (payload.length < 65_536) {
      header = Buffer.alloc(4)
      header[0] = 0x81
      header[1] = 0x80 | 126
      header.writeUInt16BE(payload.length, 2)
    } else {
      header = Buffer.alloc(10)
      header[0] = 0x81
      header[1] = 0x80 | 127
      header.writeBigUInt64BE(BigInt(payload.length), 2)
    }
    const masked = Buffer.from(payload)
    for (let i = 0; i < masked.length; i++) masked[i] = masked[i]! ^ mask[i & 3]!
    socket.write(Buffer.concat([header, mask, masked]))
  }

  /** Close the TCP link without a close frame, like a killed browser. */
  kill(): void {
    this.socket?.destroy()
  }

  private readFrames(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk])
    for (;;) {
      if (this.buffer.length < 2) return
      const opcode = this.buffer[0]! & 0x0f
      let length = this.buffer[1]! & 0x7f
      let offset = 2
      if (length === 126) {
        if (this.buffer.length < 4) return
        length = this.buffer.readUInt16BE(2)
        offset = 4
      } else if (length === 127) {
        if (this.buffer.length < 10) return
        length = Number(this.buffer.readBigUInt64BE(2))
        offset = 10
      }
      if (this.buffer.length < offset + length) return
      const payload = this.buffer.subarray(offset, offset + length)
      this.buffer = this.buffer.subarray(offset + length)
      if (opcode === 0x8) {
        this.closedResolve()
        this.socket?.end()
        return
      }
      if (opcode === 0x1) this.handleText(payload.toString('utf8'))
    }
  }

  private handleText(text: string): void {
    this.remainder += text
    let msg: { type?: string; id?: string; command?: string; params?: Record<string, unknown> }
    try {
      msg = JSON.parse(this.remainder) as typeof msg
    } catch {
      return
    }
    this.remainder = ''
    if (msg.type !== 'command' || msg.id === undefined) return
    const command: FakeExtensionCommand = { id: msg.id, command: msg.command ?? '', params: msg.params ?? {} }
    this.received.push(command)
    if (!this.autoReply) return
    try {
      this.send({ type: 'result', id: command.id, ok: true, result: this.onCommand(command) })
    } catch (error) {
      this.send({ type: 'result', id: command.id, ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }
}
