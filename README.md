# DSH Browser Control

Chrome 浏览器扩展 + DeepSeek Harness 插件，让 AI Agent 直接操控你的真实浏览器。

## 架构

`
Chrome 扩展 (MV3)  <--WebSocket-->  dsh 插件 (browser-bridge)  -->  browser_* 工具
     |                                                                    |
 chrome.debugger (CDP)                                            agent 命令执行
`

- **扩展**：安装到 Chrome 后自动外连本地桥，无需 native messaging host
- **插件**：在 dsh 设置页提供开关、端口、Token 配置，支持热启停

## 安装

### Chrome 扩展

1. 解压 extension/ 文件夹（或用 DSH-Browser-Control-0.2.0.zip）
2. Chrome 打开 chrome://extensions → 开启「开发者模式」
3. 点「加载已解压的扩展程序」→ 选择解压后的文件夹
4. 工具栏出现图标，状态显示「已连接」= 成功

### dsh 插件

将 plugin/ 目录复制到 deepseek-harness 仓库的 packages/web/browser-bridge/，然后参照 dsh-config/README.md 配置接入。

## 使用

1. 在 dsh 设置 → 插件 → DSH 浏览器控制 中开启开关
2. Chrome 扩展会自动连接（默认端口 9777，Token: dsh-local）
3. Agent 即可使用 11 个 browser_* 工具：

| 工具 | 功能 |
|---|---|
| browser_navigate | 导航到指定 URL |
| browser_read | 读取页面内容（文本/HTML） |
| browser_snapshot | 页面快照，返回可交互元素列表 |
| browser_click | 点击页面元素（by ref 或 CSS selector） |
| browser_type | 在输入框中填入文本 |
| browser_press | 模拟键盘按键 |
| browser_scroll | 滚动页面 |
| browser_tabs | 标签页管理（列表/新建/关闭/切换） |
| browser_evaluate | 在页面中执行 JavaScript |
| browser_screenshot | 截取页面截图 |
| browser_cleanup | 清理临时文件（截图 + 脚本草稿） |

## 状态页

浏览器访问 http://127.0.0.1:9777/ 可查看桥接状态（需先在 dsh 中启用插件）。

## 协议

MIT
