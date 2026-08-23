/** BridgeServer behavior: lifecycle, auth, command round-trip, HTTP face, cleanup. */
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { BridgeServer } from '../src/server.ts'
import { FakeExtension } from './helpers/fake-extension.ts'

/** Process-scoped ports keep parallel vitest workers off each other's links. */
const PORT_A = 19_000 + (process.pid % 500)
const PORT_B = PORT_A + 1

let server: BridgeServer | undefined
const roots: string[] = []
const extensions: FakeExtension[] = []

afterEach(async () => {
  await server?.stop()
  server = undefined
  for (const extension of extensions) extension.kill()
  extensions.length = 0
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-bridge-test-'))
  roots.push(root)
  return root
}

describe('BridgeServer', () => {
  it('start/stop cycles release the port and report status transitions', async () => {
    const root = await makeRoot()
    const instance = new BridgeServer({ port: PORT_A, token: 't', shotsDir: join(root, 'shots') })
    expect(instance.status.listening).toBe(false)
    await instance.start()
    expect(instance.status.listening).toBe(true)
    await instance.stop()
    expect(instance.status.listening).toBe(false)
    // A fresh listener binds the same port again after a stop.
    const second = new BridgeServer({ port: PORT_A, token: 't', shotsDir: join(root, 'shots') })
    await expect(second.start()).resolves.toBeUndefined()
    await second.stop()
  })

  it('rejects a wrong upgrade token before the handshake', async () => {
    const root = await makeRoot()
    const instance = new BridgeServer({ port: PORT_A, token: 'secret', shotsDir: join(root, 'shots') })
    server = instance
    await instance.start()
    const bad = new FakeExtension(PORT_A, 'wrong')
    extensions.push(bad)
    await expect(bad.connect()).rejects.toThrow(/401/)
    expect(instance.status.extensionConnected).toBe(false)
  })

  it('executes a command through a connected extension and reports hello in status', async () => {
    const root = await makeRoot()
    const instance = new BridgeServer({ port: PORT_A, token: 'secret', shotsDir: join(root, 'shots') })
    server = instance
    await instance.start()
    const extension = new FakeExtension(PORT_A, 'secret')
    extensions.push(extension)
    extension.onCommand = command => ({ tabId: 7, url: command.params.url })
    await extension.connect()
    await expect(instance.execute('nav', { url: 'https://example.com' })).resolves.toEqual({ tabId: 7, url: 'https://example.com' })
    expect(extension.received[0]).toMatchObject({ command: 'nav' })
    expect(instance.status.extensionConnected).toBe(true)
    expect(instance.status.hello?.browser.name).toBe('TestBrowser')
  })

  it('fails pending commands when the extension drops mid-command', async () => {
    const root = await makeRoot()
    const instance = new BridgeServer({ port: PORT_A, token: 'secret', shotsDir: join(root, 'shots') })
    server = instance
    await instance.start()
    const extension = new FakeExtension(PORT_A, 'secret')
    extensions.push(extension)
    extension.autoReply = false
    await extension.connect()
    const pending = instance.execute('eval', { expression: '1' })
    extension.kill()
    await expect(pending).rejects.toThrow(/disconnected/)
  })

  it('times out an unanswered command within the requested budget', async () => {
    const root = await makeRoot()
    const instance = new BridgeServer({ port: PORT_A, token: 'secret', shotsDir: join(root, 'shots') })
    server = instance
    await instance.start()
    const extension = new FakeExtension(PORT_A, 'secret')
    extensions.push(extension)
    extension.autoReply = false
    await extension.connect()
    await expect(instance.execute('slow', {}, { timeoutMs: 50 })).rejects.toThrow(/timed out/)
  }, 10_000)

  it('propagates an AbortSignal as a cancelled command', async () => {
    const root = await makeRoot()
    const instance = new BridgeServer({ port: PORT_A, token: 'secret', shotsDir: join(root, 'shots') })
    server = instance
    await instance.start()
    const extension = new FakeExtension(PORT_A, 'secret')
    extensions.push(extension)
    extension.autoReply = false
    await extension.connect()
    const controller = new AbortController()
    const pending = instance.execute('long', {}, { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toThrow(/cancelled/)
  })

  it('throws with guidance while no extension is connected', async () => {
    const root = await makeRoot()
    const instance = new BridgeServer({ port: PORT_A, token: 'secret', shotsDir: join(root, 'shots') })
    server = instance
    await instance.start()
    await expect(instance.execute('nav', {})).rejects.toThrow(/no browser extension connected/)
  })

  it('serves /api/status and rejects oversized bodies on /api/command', async () => {
    const root = await makeRoot()
    const instance = new BridgeServer({ port: PORT_A, token: 'secret', shotsDir: join(root, 'shots') })
    server = instance
    await instance.start()
    const status = await fetch(`http://127.0.0.1:${PORT_A}/api/status`).then(r => r.json()) as Record<string, unknown>
    expect(status).toMatchObject({ ok: true, listening: true, extensionConnected: false })
    const huge = Buffer.alloc(3 * 1024 * 1024)
    huge.fill('x')
    const response = await fetch(`http://127.0.0.1:${PORT_A}/api/command`, { method: 'POST', body: huge })
    expect(response.status).toBe(413)
  })

  it('cleanup clears the shots directory top level plus scratch files, via HTTP too', async () => {
    const root = await makeRoot()
    const shots = join(root, 'shots')
    const instance = new BridgeServer({ port: PORT_B, token: 't', shotsDir: shots, scratchDir: root })
    server = instance
    await instance.cleanup() // creates the shots directory
    await writeFile(join(shots, 'shot.png'), Buffer.from([1]))
    await writeFile(join(root, '__scratch.mjs'), '// temp script')
    await writeFile(join(root, 'not-scratch.mjs'), '// stays')
    await instance.start()
    const result = await fetch(`http://127.0.0.1:${PORT_B}/api/cleanup`, { method: 'POST' }).then(r => r.json()) as {
      ok: boolean
      shotsRemoved: number
      scratchRemoved: string[]
    }
    expect(result).toMatchObject({ ok: true, shotsRemoved: 1, scratchRemoved: ['__scratch.mjs'] })
    expect(await readdir(shots)).toEqual([])
    expect(await readdir(root)).toContain('not-scratch.mjs')
  })
})
