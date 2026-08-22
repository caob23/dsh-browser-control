# DSH Browser Control

<p align="center">
  <img src="extension/icons/icon128.png" width="100" alt="DSH Browser Control">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue?style=flat-square" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="license">
  <img src="https://img.shields.io/badge/Chrome-MV3-yellow?style=flat-square" alt="chrome mv3">
  <img src="https://img.shields.io/badge/DSH-Plugin-purple?style=flat-square" alt="dsh plugin">
  <img src="https://img.shields.io/badge/CDP-powered-orange?style=flat-square" alt="cdp">
  <img src="https://img.shields.io/badge/Tools-11_ browser_*-red?style=flat-square" alt="11 tools">
  <img src="https://img.shields.io/badge/Tests-29%2F29-brightgreen?style=flat-square" alt="tests">
</p>

Chrome 浏览器扩展 + DeepSeek Harness 插件，让 AI Agent 像人一样操控你的真实浏览器。

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

## 安装 Chrome 扩展（30 秒）

下载 [`DSH-Browser-Control-1.0.0.crx`](../../releases/download/v1.0.0/DSH-Browser-Control-1.0.0.crx)，打开 `chrome://extensions` → 开启「开发者模式」→ 把 CRX 文件直接拖进去。

> 也可以用 zip 方式：下载 `.zip` 解压后「加载已解压的扩展程序」。

## 安装 dsh 插件（1 分钟）

### 方式 A：一键安装（推荐）

```bash
git clone https://github.com/caob23/dsh-browser-control.git
cd dsh-browser-control
./install.sh /你的路径/deepseek-harness
```

### 方式 B：手动安装

下载 [`dsh-browser-bridge-plugin-v1.0.0.zip`](../../releases/download/v1.0.0/dsh-browser-bridge-plugin-v1.0.0.zip)，解压到 deepseek-harness 的 `packages/web/browser-bridge/`。

然后补充三处配置：

1. `packages/bundle/base/package.json` 加一行依赖：

    "@deepseek-ai/dsh-browser-bridge": "workspace:^"

2. `cordis.patch.yml` 的 plugins 列表加：

    - id: browser-bridge
      name: '@deepseek-ai/dsh-browser-bridge'
      config:
        enabled: false

3. `tsconfig.host.json` 的 references 加：

    { "path": "./packages/web/browser-bridge" }

重启 dsh → 设置页出现「DSH 浏览器控制」→ 开启即可。

## 使用

1. dsh 设置 → 插件 → DSH 浏览器控制 → 开启
2. Chrome 扩展自动连接（端口 9777，Token: dsh-local）
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

## v1.0.0 更新

- 🐳 新增鲸鱼 Logo（扩展 + 弹窗 + 状态页 SVG）
- 📌 持久 debugger 附着（横幅始终显示）
- 🔧 端口配置（简化自完整 URL）
- 🖥️ 状态页 SVG logo + 暗色卡片样式
- ✅ 29/29 测试通过

## License

[MIT](LICENSE)
