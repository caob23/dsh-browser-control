<p align="center">
  <img src="extension/icons/icon128.png" width="100" alt="DSH Browser Control">
</p>

<h1 align="center">DSH Browser Control</h1>

<p align="center">
  Chrome 浏览器扩展 + DeepSeek Harness 插件<br>
  让 AI Agent 像人一样操控你的真实浏览器
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.2.0-blue" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license">
  <img src="https://img.shields.io/badge/Chrome-MV3-yellow" alt="chrome mv3">
  <img src="https://img.shields.io/badge/DSH-Plugin-purple" alt="dsh plugin">
</p>

---

## 这是什么

一句话：**AI 可以像人一样用你的浏览器**。

不是无头浏览器，不是 Puppeteer——是你的**真实 Chrome**，带着你的登录态、你的 cookies、你的所有书签。AI 通过 Chrome DevTools Protocol 驱动标签页，你可以在屏幕上看到每一步操作。

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

---

## 它能做什么

### 🔍 百度搜索 → 提取结果

```
Agent: 打开百度，搜索 DeepSeek Harness，提取第一条结果标题

→ 导航到 baidu.com
→ 定位搜索框，输入关键词
→ 点击搜索
→ 等待结果加载
→ 提取前 5 条结果标题
```

### 💬 B 站发私信

```
Agent: 去 B 站找用户「某位 UP 主」，发一条简短介绍

→ 打开 B 站用户搜索页
→ 在快照中定位用户主页链接
→ 进入用户空间
→ 点击「发消息」→ 新标签页打开私信窗口
→ 在富文本编辑器中输入消息
→ 按回车发送
→ 验证消息气泡出现 ✅
```

### 🎬 B 站搜索 → 统计视频卡片

```
Agent: 打开 B 站，搜索 CS2，统计视频卡片数量

→ 打开 bilibili.com
→ 定位顶部搜索框
→ 输入 CS2 并搜索
→ 等待页面渲染
→ 统计 .bili-video-card 元素数量
→ 截图保存到桌面
```

### 📝 洛谷解题（AC）

```
Agent: 去洛谷做 P1001 题

→ 打开洛谷 P1001 页面
→ 在代码编辑器中写入解题代码
→ 处理验证码
→ 提交代码
→ 等待评测结果
→ 用户确认：作对了 ✅
```

---

## 架构

```
┌─────────────────────────────────────────────────────────┐
│  Chrome 浏览器                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  DSH Browser Control 扩展 (MV3)                  │  │
│  │                                                   │  │
│  │  chrome.debugger (CDP)                            │  │
│  │    ├─ Runtime.evaluate  → 执行 JS                 │  │
│  │    ├─ Input.dispatch*   → 键盘/鼠标事件            │  │
│  │    ├─ Page.capture*     → 截图                     │  │
│  │    └─ DOM.getBoxModel  → 元素定位                  │  │
│  │                                                   │  │
│  │  WebSocket ──────────────────────────→ 桥接服务    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  你的真实标签页（带着 cookies、登录态）                    │
└─────────────────────────────────────────────────────────┘
                        ↕ JSON over WebSocket
┌─────────────────────────────────────────────────────────┐
│  DeepSeek Harness                                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │  @deepseek-ai/dsh-browser-bridge 插件             │  │
│  │                                                   │  │
│  │  • WebSocket 服务（127.0.0.1:9777）               │  │
│  │  • 11 个 browser_* 工具注册到 ctx.tools            │  │
│  │  • Settings 卡片：开关 / 端口 / Token / 截图目录    │  │
│  │  • 截图落盘 + 临时文件清理                          │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  Agent 调用工具 → 桥转发命令 → 扩展执行 → 结果返回        │
└─────────────────────────────────────────────────────────┘
```

**关键设计决策：**
- 扩展**主动外连**桥（不需要 native messaging host、不需要注册表）
- 默认**关闭**挂载，用户在设置页手动开启
- 持久 debugger 附着——控制期间 Chrome 横幅**始终显示**
- 仅监听 `127.0.0.1`，token 认证

---

## 11 个浏览器工具

| 工具 | 功能 | 示例 |
|---|---|---|
| `browser_navigate` | 导航到 URL | 打开 bilibili.com |
| `browser_read` | 读取页面文本/HTML | 提取文章正文 |
| `browser_snapshot` | 快照 → ref 交互树 | 定位按钮、链接、输入框 |
| `browser_click` | 点击元素（by ref / selector） | 点击搜索按钮 |
| `browser_type` | 填入文本 | 在搜索框输入关键词 |
| `browser_press` | 模拟键盘按键 | 按 Enter 发送 |
| `browser_scroll` | 滚动页面 | 翻页浏览 |
| `browser_tabs` | 标签页管理 | 新建 / 关闭 / 切换标签 |
| `browser_evaluate` | 执行任意 JS | 提取页面数据 |
| `browser_screenshot` | 截图（支持全页） | 保存页面快照 |
| `browser_cleanup` | 清理临时文件 | 删除截图和脚本草稿 |

**snapshot + click/type 的工作流：**
1. `browser_snapshot` 返回页面可交互元素列表，每个元素带 `ref` 编号（如 `e14`）
2. `browser_click({ ref: "e14" })` 精确点击该元素
3. `browser_type({ ref: "e14", value: "搜索词" })` 在该输入框填入文本

---

## 安装

### Chrome 扩展

1. 下载 [`DSH-Browser-Control-0.2.0.zip`](../../releases/download/v0.2.0/DSH-Browser-Control-0.2.0.zip)
2. 解压到一个**固定文件夹**（以后别删）
3. Chrome 打开 `chrome://extensions` → 开启右上角 **开发者模式**
4. 点 **加载已解压的扩展程序** → 选择解压后的文件夹
5. 工具栏出现图标，点击弹窗显示 **已连接** = 成功

### dsh 插件

```bash
# 1. 克隆仓库
git clone https://github.com/caob23/dsh-browser-control.git

# 2. 复制插件到 dsh 仓库
cp -r dsh-browser-control/plugin/* \
  /path/to/deepseek-harness/packages/web/browser-bridge/

# 3. 参照接入说明配置 dsh
cat dsh-browser-control/dsh-config/README.md
```

接入步骤：
- `cordis.patch.yml` 加插件挂载行
- `package.json` 加 workspace 依赖
- `tsconfig.host.json` 加类型引用
- 重启 dsh → 设置页出现「DSH 浏览器控制」卡片

---

## 使用

1. **dsh 设置** → **插件** → **DSH 浏览器控制** → **开启开关**
2. **Chrome 扩展自动连接**（看图标变绿）
3. **对话框里说一句话**，Agent 自动操控浏览器

### 检查连接状态

- 浏览器打开 `http://127.0.0.1:9777/` → 暗色状态卡片
- 弹窗图标：`ON` = 已连接，`OFF` = 未连接

### 配置

| 设置项 | 默认值 | 说明 |
|---|---|---|
| 端口 | `9777` | 桥接监听端口 |
| Token | `dsh-local` | 扩展连接认证 |
| 自动连接 | ✅ | 浏览器启动时自动连桥 |
| 截图目录 | `dsh-browser-shots/` | 截图保存位置 |

---

## 测试验证

| 场景 | 结果 |
|---|---|
| 洛谷 P1001 解题（写代码 + 提交 + AC） | ✅ |
| B 站搜索用户 → 发私信（18 字） | ✅ |
| 百度搜索 → 提取结果标题 | ✅ |
| B 站搜索 → 统计视频卡片 + 截图 | ✅ |
| 单元测试 29/29 | ✅ |
| 类型检查（host + client） | ✅ |
| 组合门禁 130 配置文件 | ✅ |

---

## 文件结构

```
├── extension/              # Chrome 扩展
│   ├── manifest.json       # MV3 清单
│   ├── background.js       # Service Worker（核心逻辑）
│   ├── popup.html/js       # 弹窗 UI
│   └── icons/              # 图标
│
├── plugin/                 # dsh 插件
│   ├── src/
│   │   ├── index.ts        # 工具注册 + 插件入口
│   │   ├── server.ts       # WebSocket 桥 + HTTP API + 状态页
│   │   ├── ws.ts           # RFC 6455 帧编解码
│   │   └── invariant.ts    # 运行时契约
│   ├── tests/              # 29 个测试
│   ├── lib/                # 构建产物（可直接用）
│   └── package.json
│
├── dsh-config/             # dsh 接入说明
├── DSH-Browser-Control-0.2.0.zip  # 扩展安装包
└── signing-key.pem         # CRX 签名密钥（升级时需要）
```

---

## 技术栈

- **Chrome MV3** Service Worker（无持久页面）
- **Chrome DevTools Protocol**（Runtime.evaluate / Input.dispatch* / Page.capture*）
- **WebSocket**（扩展 → 桥，JSON 文本帧）
- **Node.js HTTP**（状态页 + 清理 API + 命令面）
- **RFC 6455** 帧编解码（服务端实现）
- **Cordis 插件系统**（DeepSeek Harness 生态）
- **TypeScript**（strict 模式，完整类型）

---

## License

[MIT](LICENSE)
