# DSH Browser Control v1.0.0

Chrome 浏览器扩展 + DeepSeek Harness 插件，让 AI Agent 像人一样操控你的真实浏览器。

## 附件

| 文件 | 用途 |
|---|---|
| `DSH-Browser-Control-1.0.0.zip` | Chrome 扩展 |
| `dsh-browser-bridge-plugin-v1.0.0.zip` | dsh 插件 |

## 一、安装 Chrome 扩展（30 秒）

1. 下载 `DSH-Browser-Control-1.0.0.zip`，解压到固定文件夹
2. Chrome 打开 `chrome://extensions` → 开启「开发者模式」
3. 点「加载已解压的扩展程序」→ 选解压后的文件夹
4. 工具栏出现鲸鱼图标 → 点击显示「已连接」= 成功

## 二、安装 dsh 插件（1 分钟）

下载 `dsh-browser-bridge-plugin-v1.0.0.zip`，解压到你的 deepseek-harness 仓库：

```bash
# 解压后复制到 dsh 的 browser-bridge 包目录
cp -r plugin/* /你的路径/deepseek-harness/packages/web/browser-bridge/
```

然后在 `packages/bundle/base/package.json` 加一行依赖：
```json
"@deepseek-ai/dsh-browser-bridge": "workspace:^"
```

在 `packages/bundle/base/cordis.patch.yml` 的 plugins 列表加：
```yaml
- id: browser-bridge
  name: '@deepseek-ai/dsh-browser-bridge'
  config:
    enabled: false
```

在 `tsconfig.host.json` 的 references 加：
```json
{ "path": "./packages/web/browser-bridge" }
```

重启 dsh → 设置页出现「DSH 浏览器控制」卡片 → 开启即可。

## 三、使用

1. dsh 设置 → 插件 → DSH 浏览器控制 → 开启
2. Chrome 扩展自动连接（端口 9777，Token: dsh-local）
3. 对话中说自然语言，Agent 自动操控浏览器

访问 `http://127.0.0.1:9777/` 查看连接状态。

## 工具清单

`browser_navigate` `browser_read` `browser_snapshot` `browser_click` `browser_type` `browser_press` `browser_scroll` `browser_tabs` `browser_evaluate` `browser_screenshot` `browser_cleanup`

## v1.0.0 更新

- 🐳 新增鲸鱼 Logo（扩展 + 弹窗 + 状态页）
- 🖥️ 状态页左上角 SVG logo
- 📌 持久 debugger 附着（控制期间 Chrome 横幅始终显示）
- 🔧 端口配置（简化自完整 URL）
- ✅ 29/29 测试通过，host 构建验证
