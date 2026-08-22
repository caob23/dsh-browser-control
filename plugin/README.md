# @deepseek-ai/dsh-browser-bridge

English | [中文](README.zh.md)

A local bridge between the harness and the **DSH Browser Control** browser extension: the plugin listens on `ws://127.0.0.1:<port>/ws`, the extension connects out (no native-messaging host, no registry setup), and the model drives the user's real, logged-in browser through eleven `browser_*` tools.

This is a function plugin (`inject: ['tools']`). Tools register whenever the plugin mounts; the Settings-managed `enabled` flag starts and stops the listener live — off keeps every tool mounted but makes each call report the toggle, so opting in stays explicit and the model can say exactly what to do instead of hanging.

## Architecture

```
browser extension (MV3, chrome.debugger)  ⇄  this plugin (WS+HTTP, 127.0.0.1 only)  ⇄  browser_* tools
```

The wire protocol is one JSON object per text frame: the server sends `{type:'command', id, command, params}`, the extension answers `{type:'result', id, ok, result?|error}`, and announces itself with `{type:'hello', client, version, browser}`. Exactly one extension link is held; a newer WebSocket replaces an older one. A small HTTP face shares the port for humans and scripts:

| Route | Meaning |
|---|---|
| `GET /` | Status page (zh) with live link state and a cleanup button |
| `GET /api/status` | JSON link state |
| `POST /api/command` | Same command dispatch the tools use (`{command, params, timeoutMs?}`) |
| `POST /api/cleanup` | Delete screenshots plus agent scratch files |

## Config

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `false` | Whether the bridge listens. Toggled from Settings → Plugins → DSH 浏览器控制; changes apply without a reload. |
| `port` | `9777` | Loopback port for the WebSocket and the HTTP face (1024–65535). |
| `token` | `dsh-local` | Shared secret the extension presents on the upgrade query; guards a 127.0.0.1 socket against other local processes. |
| `shotsDir` | `dsh-browser-shots` | Directory `browser_screenshot` writes into and `browser_cleanup` clears; relative paths resolve against the process working directory. |

```yaml
- id: browser-bridge
  name: '@deepseek-ai/dsh-browser-bridge'
  config:
    enabled: false
```

The entry is the base layer of the `browser-bridge` Settings section; the shipped default stays off, matching the mounted-but-disabled precedent for opt-in capabilities.

## Tools

`browser_navigate`, `browser_read` (text/HTML with a truncation bound), `browser_snapshot` (numbers interactive elements with stable `e<n>` refs), `browser_click` / `browser_type` (by ref or CSS selector; real mouse/keyboard events, React-compatible input events), `browser_press`, `browser_scroll`, `browser_tabs`, `browser_evaluate` (JSON result), `browser_screenshot` (saves a PNG/JPEG and returns the absolute path), `browser_cleanup`.

`browser_snapshot`/`browser_scroll` require extension ≥ 0.2.0; older extensions answer `unknown command`, which names the fix.

## Model Experience

### browser_* tool face

#### What the model sees

Eleven tools whose descriptions and failures are written from the task perspective: calls on the active tab unless `tabId` is passed, snapshot refs instead of guessed selectors, and failures that name the fix — the bridge being disabled points at the Settings toggle, a missing extension points at the browser, and a dropped link fails the in-flight call with `the browser extension disconnected`.

#### Token effect

Zero tokens while idle beyond the registered schemas and one prompt section. Results scale with page content; `browser_read` truncates at 120,000 characters with a `truncated` flag, and screenshots return only a file path plus byte count.

#### KV Cache effect

Registration is stable across turns; results append without invalidating the request prefix.

## Known Limitations and Deferred Work

- **One link at a time** — a second browser replaces the first rather than multiplexing; per-browser targeting beyond `tabs.*` is not modeled.
- **`chrome.debugger` shows the browser's automation banner** while the bridge holds a page — cosmetic, but visible to the user.
- **No cross-origin iframes beyond CDP defaults** — `browser_evaluate` runs in the main world of the top frame.
- **Cleanup is top-level only** — nested trees under `shotsDir` or scratch directories are never recursed into.
