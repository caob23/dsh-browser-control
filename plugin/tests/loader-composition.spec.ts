/**
 * REAL composition for the browser bridge: cordis.yml booted through the real
 * Loader, the model-facing `browser_*` face asserted on the real registry, and
 * one end-to-end command carried over a live WebSocket by a scripted extension.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { CallId } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import AgentRegistry, { Inbox } from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as BrowserBridge from '@deepseek-ai/dsh-browser-bridge'
import { FakeExtension } from './helpers/fake-extension.ts'

const PORT = 19_500 + (process.pid % 400)

let root: string | undefined
let context: Context | undefined
const extensions: FakeExtension[] = []

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  for (const extension of extensions) extension.kill()
  extensions.length = 0
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

function agent(ctx: Context): Agent {
  const scope = ctx.plugin(() => {})
  const id = SessionId('browser-bridge-loader-agent')
  const session = Session.create(id)
  const value: Agent = {
    id, options: {}, session, inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'idle', ctx: scope.ctx,
    followup: () => {}, steer: () => {}, inject: () => {}, send: () => {}, cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  ctx.agents.register(value)
  return value
}

function resultText(result: { content: { type: string; text?: string }[] }): string {
  return result.content.filter(block => block.type === 'text').map(block => block.text).join('')
}

/**
 * Boot a cordis.yml carrying the given browser-bridge config block.
 * @param configLines - YAML lines nested under the plugin's `config:` key, or a
 *   factory receiving the temp `shotsDir` (the root only exists inside this call).
 * @returns the booted context.
 */
async function boot(configLines: readonly string[] | ((shotsDir: string) => readonly string[])): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-browser-bridge-loader-'))
  const lines = typeof configLines === 'function' ? configLines(join(root, 'shots')) : configLines
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-agent'",
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-tools'",
    "- name: '@deepseek-ai/dsh-browser-bridge'",
    ...lines.length > 0 ? ['  config:', ...lines] : [],
    '',
  ].join('\n'))

  const ctx = new Context()
  context = ctx
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-agent', AgentRegistry],
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-tools', ToolRuntime],
    ['@deepseek-ai/dsh-browser-bridge', BrowserBridge],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  return ctx
}

const TOOL_NAMES = [
  'browser_navigate', 'browser_read', 'browser_snapshot', 'browser_click',
  'browser_type', 'browser_press', 'browser_scroll', 'browser_tabs',
  'browser_evaluate', 'browser_screenshot', 'browser_cleanup',
]

describe('browser-bridge real Loader composition through cordis.yml', () => {
  it('registers the full model-facing browser_* face while enabled', async () => {
    const ctx = await boot(shotsDir => [
      `    enabled: true`,
      `    port: ${PORT}`,
      `    token: compose-token`,
      `    shotsDir: ${JSON.stringify(shotsDir.replaceAll('\\', '/'))}`,
    ])
    const names = ctx.tools.schemas().map(schema => schema.name)
    for (const name of TOOL_NAMES) expect(names).toContain(name)
  }, 30_000)

  it('carries a browser_navigate end to end over a live extension link', async () => {
    const ctx = await boot(shotsDir => [
      `    enabled: true`,
      `    port: ${PORT}`,
      `    token: compose-token`,
      `    shotsDir: ${JSON.stringify(shotsDir.replaceAll('\\', '/'))}`,
    ])
    const extension = new FakeExtension(PORT, 'compose-token')
    extensions.push(extension)
    extension.onCommand = command => ({ tabId: 1, url: command.params.url, title: 'Example' })
    await extension.connect()

    const owner = agent(ctx)
    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('e2e-nav'),
      name: 'browser_navigate',
      arguments: { url: 'https://example.test/' },
      agent: owner,
    })
    expect(result.isError).toBe(false)
    expect(extension.received[0]).toMatchObject({ command: 'nav' })
    expect(resultText(result)).toContain('https://example.test/')
  }, 30_000)

  it('answers every browser_* call with actionable copy while disabled', async () => {
    const ctx = await boot(['    enabled: false'])
    const owner = agent(ctx)
    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('disabled-call'),
      name: 'browser_read',
      arguments: {},
      agent: owner,
    })
    expect(result.isError).toBe(true)
    expect(resultText(result)).toContain('设置')
  }, 30_000)

  it('removes the whole browser_* face when the plugin fiber is disposed (HMR safety)', async () => {
    // Unit tier: the disposal proof rides one plugin fiber over real services;
    // the real-composition boots above already prove the mounted behavior.
    const ctx = new Context()
    context = ctx
    const plugin = {
      name: BrowserBridge.name,
      inject: BrowserBridge.inject,
      Config: BrowserBridge.Config,
      apply: BrowserBridge.apply,
    }
    ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    const scope = await ctx.plugin(plugin as never, { enabled: false } as never)
    expect(ctx.tools.schemas().map(schema => schema.name)).toContain('browser_navigate')
    await scope.dispose()
    expect(ctx.tools.schemas().map(schema => schema.name)).not.toContain('browser_navigate')
  }, 30_000)
})
