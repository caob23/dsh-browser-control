# DSH Browser Control

<p align="center">
  <img src="extension/icons/icon128.png" width="100" alt="DSH Browser Control">
</p>

<p align="center">
  <a href="README.md">简体中文</a> · <a href="README.en.md">English</a>
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

Chrome 浏览器扩展 + DeepSeek Harness 插件，让 AI Agent 像人一样操控你的真实浏览器。

<p align="center">
  <img src="assets/banner.png" width="480" alt="DSH Browser Control — a whale searching Google with a mouse">
</p>

## 这是什么

不是无头浏览器，不是 Puppeteer——是你的**真实 Chrome**，带着你的登录态、你的 cookies。AI 通过 Chrome DevTools Protocol 驱动标签页，你可以在屏幕上看到每一步操作。

```
你对 AI 说一句话
      ↓
Agent 调用 browser_* 工具
      ↓
DSH 插件（WebSocket 桥）
      ↓
Chrome 扩展（CDP 驱动）
      ↓
你的真实浏览器执行操作
      ↓
结果返回给 Agent
```

## 和 MCP 浏览器方案的区别

市面上已经有 Playwright MCP、Puppeteer MCP、browser-use 等，它们的共同点：启动一个**自己下载的全新浏览器实例**。本项目走的是另一条路：

| | 本项目 | Playwright / Puppeteer MCP |
|---|---|---|
| 浏览器 | 你正在用的真实 Chrome | 自动下载的独立实例 |
| 登录态 / Cookies | ✅ 全部继承，无需重新登录 | ❌ 每次全新 profile |
| 过验证码 / 扫码登录 | 你的会话已经登录，基本不遇到 | 经常卡在登录墙 |
| 可见性 | 屏幕上实时可见，随时鼠标接管 | 无头运行或独立窗口 |
| 环境依赖 | 无需 Node / npx / Python | 需要 npx 或 uvx 运行时 |
| 接入方式 | 加载扩展 + 设置页开关 | 编辑 MCP 客户端 JSON 配置 |
| 磁盘占用 | 复用现有 Chrome，零新增 | 额外下载数百 MB 浏览器 |
| 集成深度 | dsh 原生插件（设置卡片 / 状态页 / 清理按钮） | 通用 MCP server |

一句话：**要 AI 用"你自己的"浏览器干活（已登录的 B 站、知乎、淘宝后台），用本项目；要做跨浏览器、跨应用的通用自动化测试，用 MCP。**

## 下载

| 文件 | 说明 |
|---|---|
| [DSH-Browser-Control-1.0.1.zip](https://github.com/caob23/dsh-browser-control/releases/download/v1.0.1/DSH-Browser-Control-1.0.1.zip) | Chrome 扩展（解压后加载） |
| [dsh-browser-bridge-plugin-v1.0.1.zip](https://github.com/caob23/dsh-browser-control/releases/download/v1.0.1/dsh-browser-bridge-plugin-v1.0.1.zip) | dsh 插件 |

## 安装 Chrome 扩展（30 秒）

下载 zip → 解压到固定文件夹（别删）→ Chrome 打开 `chrome://extensions` → 开启「开发者模式」→ 点「加载已解压的扩展程序」→ 选解压后的文件夹。

工具栏出现鲸鱼图标 → 绿点呼吸 = 已连接。需要 Chrome 116+。

## 安装 dsh 插件（1 分钟）

### 方式 A：一键安装（推荐）

```bash
git clone https://github.com/caob23/dsh-browser-control.git
cd dsh-browser-control
./install.sh /你的路径/deepseek-harness
```

脚本只负责把插件文件复制到位，**完成后仍需手动改三处配置**（同方式 B 的第 2 步），改完重启 dsh 才会生效。

### 方式 B：手动安装

下载 [`dsh-browser-bridge-plugin-v1.0.1.zip`](https://github.com/caob23/dsh-browser-control/releases/download/v1.0.1/dsh-browser-bridge-plugin-v1.0.1.zip)，解压到 deepseek-harness 的 `packages/web/browser-bridge/`。

然后补充三处配置：

1. `packages/bundle/base/package.json` 的 dependencies 加：

```json
"@deepseek-ai/dsh-browser-bridge": "workspace:^"
```

2. `cordis.patch.yml` 的 plugins 列表加：

```yaml
- id: browser-bridge
  name: '@deepseek-ai/dsh-browser-bridge'
  config:
    enabled: false
```

3. `tsconfig.host.json` 的 references 加：

```json
{ "path": "./packages/web/browser-bridge" }
```

重启 dsh → 设置页出现「DSH 浏览器控制」→ 开启即可。详细说明见 [dsh-config/README.md](dsh-config/README.md)。

## 使用

1. dsh 设置 → 插件 → DSH 浏览器控制 → 开启
2. Chrome 扩展自动连接（端口 9777，Token 默认 dsh-local）
3. 对话说自然语言，Agent 自动操控浏览器

访问 `http://127.0.0.1:9777/` 查看连接状态。

## 工具清单

| 工具 | 功能 |
|---|---|
| `browser_navigate` | 导航到 URL |
| `browser_read` | 读取页面文本/HTML |
| `browser_snapshot` | 页面快照 → ref 交互树 |
| `browser_click` | 点击元素（by ref / selector） |
| `browser_type` | 在输入框填入文本 |
| `browser_press` | 模拟键盘按键 |
| `browser_scroll` | 滚动页面 |
| `browser_tabs` | 标签页管理（列表/新建/关闭/切换） |
| `browser_evaluate` | 执行任意 JS |
| `browser_screenshot` | 截取页面截图 |
| `browser_cleanup` | 清理临时文件 |

## 架构

```
Chrome 浏览器
  └─ DSH Browser Control 扩展 (MV3)
       └─ chrome.debugger (CDP)
            └─ WebSocket ──────→ DSH 插件 (browser-bridge)
                                      └─ browser_* 工具 → Agent
```

**关键设计：**
- 扩展主动外连桥（不需要 native messaging host）
- 默认关闭，设置页手动开启
- 持久 debugger 附着——控制期间横幅始终显示
- 仅监听 127.0.0.1，token 认证

## 已验证

| 场景 | 结果 |
|---|---|
| 百度搜索 → 提取结果标题 | ✅ |
| B 站搜索用户 → 发私信 | ✅ |
| B 站搜索 → 统计视频卡片 + 截图 | ✅ |
| 单元测试 29/29 | ✅ |
| 类型检查（host + client） | ✅ |

## 更新日志

见 [CHANGELOG.md](CHANGELOG.md)。

## License

[MIT](LICENSE)
