# DSH Browser Control

<p align="center">
  <img src="extension/icons/icon128.png" width="100" alt="DSH Browser Control">
</p>

<p align="center">
  <a href="README.md">绠€浣撲腑鏂?/a> 路 <a href="README.en.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/caob23/dsh-browser-control/releases"><img src="https://img.shields.io/badge/version-1.0.1-blue?style=flat-square" alt="version"></a>
  <a href="https://github.com/caob23/dsh-browser-control/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="license"></a>
  <a href="https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline"><img src="https://img.shields.io/badge/Chrome-MV3-yellow?style=flat-square" alt="chrome mv3"></a>
  <a href="https://github.com/topics/dsh-plugin"><img src="https://img.shields.io/badge/DSH-Plugin-purple?style=flat-square" alt="dsh plugin"></a>
  <img src="https://img.shields.io/badge/CDP-powered-orange?style=flat-square" alt="cdp">
  <img src="https://img.shields.io/badge/tools-11-red?style=flat-square" alt="11 browser tools">
  <img src="https://img.shields.io/badge/tests-29%2F29-brightgreen?style=flat-square" alt="tests">
</p>

A Chrome extension + DeepSeek Harness plugin that lets AI agents drive your real browser like a human.

<p align="center">
  <img src="assets/banner.png" width="480" alt="DSH Browser Control 鈥?a whale searching Google with a mouse">
</p>

## What is this

Not a headless browser, not Puppeteer 鈥?your **real Chrome**, with your logins and cookies. The AI drives tabs through the Chrome DevTools Protocol while you watch every step on screen.

```
You say one sentence to the AI
      鈫?Agent calls browser_* tools
      鈫?DSH plugin (WebSocket bridge)
      鈫?Chrome extension (CDP)
      鈫?Your real browser performs the action
      鈫?Result returns to the Agent
```

## How it differs from MCP browser solutions

Browsers via MCP (Playwright MCP, Puppeteer MCP, browser-use鈥? share one trait: they launch a **fresh browser instance they downloaded themselves**. This project takes the other road:

| | This project | Playwright / Puppeteer MCP |
|---|---|---|
| Browser | The real Chrome you are using | Separate auto-downloaded instance |
| Logins / Cookies | 鉁?Fully inherited, no re-login | 鉂?Fresh profile every time |
| CAPTCHAs / QR login | Rarely hit 鈥?your sessions stay logged in | Frequently stuck at login walls |
| Visibility | Live on your screen, grab the mouse anytime | Headless or separate window |
| Environment deps | No Node / npx / Python needed | Needs npx or uvx runtime |
| Setup | Load extension + settings toggle | Edit MCP client JSON config |
| Disk usage | Reuses existing Chrome, zero extra | Downloads hundreds of MB |
| Integration depth | Native dsh plugin (settings card / status page / cleanup button) | Generic MCP server |

In one line: **for "use MY browser" tasks (logged-in Bilibili, Zhihu, admin panels), use this project; for generic cross-browser test automation, use MCP.**

## Download

| File | Purpose |
|---|---|
| [DSH-Browser-Control-1.0.1.zip](https://github.com/caob23/dsh-browser-control/releases/download/v1.0.1/DSH-Browser-Control-1.0.1.zip) | Chrome extension (unzip and load) |
| [dsh-browser-bridge-plugin-v1.0.1.zip](https://github.com/caob23/dsh-browser-control/releases/download/v1.0.1/dsh-browser-bridge-plugin-v1.0.1.zip) | dsh plugin |

## Install the Chrome extension (30 seconds)

Download the zip 鈫?unzip to a fixed folder (don't delete it) 鈫?open `chrome://extensions` 鈫?enable Developer mode 鈫?click "Load unpacked" 鈫?pick the unzipped folder.

Whale icon in the toolbar = success. Requires Chrome 116+.

## Install the dsh plugin (1 minute)

### Option A: one-line install (recommended)

```bash
git clone https://github.com/caob23/dsh-browser-control.git
cd dsh-browser-control
./install.sh /path/to/deepseek-harness
```

The script only copies plugin files into place 鈥?**you still need the three manual config edits** (same as Option B, step 2), then restart dsh.

### Option B: manual install

Download [`dsh-browser-bridge-plugin-v1.0.1.zip`](https://github.com/caob23/dsh-browser-control/releases/download/v1.0.1/dsh-browser-bridge-plugin-v1.0.1.zip) and unzip into `deepseek-harness/packages/web/browser-bridge/`.

Then add three pieces of config:

1. In `packages/bundle/base/package.json` dependencies:

```json
"@deepseek-ai/dsh-browser-bridge": "workspace:^"
```

2. In `cordis.patch.yml` plugins list:

```yaml
- id: browser-bridge
  name: '@deepseek-ai/dsh-browser-bridge'
  config:
    enabled: false
```

3. In `tsconfig.host.json` references:

```json
{ "path": "./packages/web/browser-bridge" }
```

Restart dsh 鈫?the "DSH Browser Control" card appears in Settings 鈫?enable it. Details in [dsh-config/README.md](dsh-config/README.md).

## Usage

1. dsh Settings 鈫?Plugins 鈫?DSH Browser Control 鈫?enable
2. The extension connects automatically (port 9777, default token dsh-local)
3. Talk in natural language; the agent drives the browser

Visit `http://127.0.0.1:9777/` for connection status.

## Tools

| Tool | Purpose |
|---|---|
| `browser_navigate` | Navigate to a URL |
| `browser_read` | Read page text/HTML |
| `browser_snapshot` | Page snapshot 鈫?ref interaction tree |
| `browser_click` | Click an element (by ref / selector) |
| `browser_type` | Type into inputs |
| `browser_press` | Send keyboard keys |
| `browser_scroll` | Scroll the page |
| `browser_tabs` | Tab management (list/open/close/activate) |
| `browser_evaluate` | Run arbitrary JS |
| `browser_screenshot` | Capture page screenshot |
| `browser_cleanup` | Clean up temp files |

## Architecture

```
Chrome browser
  鈹斺攢 DSH Browser Control extension (MV3)
       鈹斺攢 chrome.debugger (CDP)
            鈹斺攢 WebSocket 鈹€鈹€鈹€鈹€鈹€鈹€鈫?DSH plugin (browser-bridge)
                                      鈹斺攢 browser_* tools 鈫?Agent
```

**Key design:**
- Extension dials out to the bridge (no native messaging host)
- Off by default; enabled manually from Settings
- Persistent debugger attachment 鈥?banner stays visible during control
- Listens on 127.0.0.1 only, token-authenticated

## Verified

| Scenario | Result |
|---|---|
| Baidu search 鈫?extract result titles | 鉁?|
| Bilibili user search 鈫?send DM | 鉁?|
| Bilibili search 鈫?count video cards + screenshot | 鉁?|
| Unit tests 29/29 | 鉁?|
| Type checks (host + client) | 鉁?|

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
