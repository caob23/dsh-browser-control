# @deepseek-ai/dsh-browser-bridge

[English](README.md) | 中文

dsh 与 **DSH Browser Control** 浏览器扩展之间的本机桥：插件监听 `ws://127.0.0.1:<端口>/ws`，扩展主动外连（无需原生宿主、无需注册表），模型即可通过十一个 `browser_*` 工具操作用户真实、带登录态的浏览器。

这是函数插件（`inject: ['tools']`）。工具随插件挂载即注册；设置页管理的 `enabled` 开关实时启停监听 —— 关闭时工具仍在，但每次调用都会提示去打开开关，保持显式加入，模型也能说出解决办法而不是干等。

## 架构

```
浏览器扩展 (MV3, chrome.debugger)  ⇄  本插件 (WS+HTTP, 仅 127.0.0.1)  ⇄  browser_* 工具
```

线上协议为每帧一个 JSON 对象：服务端发 `{type:'command', id, command, params}`，扩展回 `{type:'result', id, ok, result?|error}`，并以 `{type:'hello', client, version, browser}` 自报家门。同一时刻只持有一条扩展链路，新连接替换旧连接。HTTP 面与 WS 共用端口：

| 路由 | 用途 |
|---|---|
| `GET /` | 状态页（中文），含实时连接状态和清理按钮 |
| `GET /api/status` | JSON 链路状态 |
| `POST /api/command` | 与工具相同的命令分发（`{command, params, timeoutMs?}`） |
| `POST /api/cleanup` | 删除截图与 agent 临时文件 |

## 配置

| 键 | 默认 | 含义 |
|---|---|---|
| `enabled` | `false` | 是否监听。在 设置 → 插件 → DSH 浏览器控制 中切换；改动即时生效，无需重启。 |
| `port` | `9777` | WebSocket 与 HTTP 共用的回环端口（1024–65535）。 |
| `token` | `dsh-local` | 扩展升级握手时出示的共享密钥；防止本机其他进程冒充扩展。 |
| `shotsDir` | `dsh-browser-shots` | `browser_screenshot` 的落盘目录，也是 `browser_cleanup` 的清理范围；相对路径按进程工作目录解析。 |

```yaml
- id: browser-bridge
  name: '@deepseek-ai/dsh-browser-bridge'
  config:
    enabled: false
```

该条目是 `browser-bridge` 设置节的组合层；出厂默认关闭，与其他可选能力的「挂载但停用」先例一致。

## 工具

`browser_navigate`、`browser_read`（正文/HTML，带截断上限）、`browser_snapshot`（给可交互元素编号出稳定 `e<n>` 引用）、`browser_click` / `browser_type`（按引用或 CSS 选择器；真实鼠标键盘事件，兼容 React 的输入事件）、`browser_press`、`browser_scroll`、`browser_tabs`、`browser_evaluate`（JSON 结果）、`browser_screenshot`（保存 PNG/JPEG 并返回绝对路径）、`browser_cleanup`。

`browser_snapshot`/`browser_scroll` 需要扩展 ≥ 0.2.0；旧扩展会答「未知命令」，错误信息会说明原因。

## 模型体验

### browser_* 工具面

#### 模型看到什么

十一个从任务视角撰写描述与失败的调用：默认作用于当前活动标签页（可传 `tabId`）、优先快照引用而非瞎猜选择器、失败信息指明出路 —— 未启用指向设置开关，没有浏览器指向扩展安装，链接中断则让进行中的调用以 `the browser extension disconnected` 失败。

#### Token 影响

空闲时除已注册的 schema 和一段提示词外为零开销。结果随页面内容伸缩；`browser_read` 在 12 万字符处截断并标记 `truncated`，截图只返回文件路径加字节数。

#### KV Cache 影响

注册跨轮次稳定；结果追加不破坏既有前缀缓存。

## 已知限制与延期工作

- **同时只有一条链路** — 后连的浏览器替换先连的，不做多路复用；除 `tabs.*` 外不建模多浏览器定向。
- **挂接页面期间浏览器显示自动化横幅** — 这是 `chrome.debugger` 的外观行为，不影响功能。
- **跨域 iframe 不超出 CDP 默认能力** — `browser_evaluate` 只运行在顶层框架主世界。
- **清理仅限顶层** — `shotsDir` 与临时目录下的嵌套树不会被递归删除。
