# 更新日志

## v1.0.4 (2026-08-23)

- 变更：许可证 MIT → **AGPL-3.0**。个人/学术/非商业免费；企业闭源商用需商业许可（联系：GitHub Issues 或 caob2333@outlook.com）
- 文档：SECURITY.md 允许非可利用问题直接提 Issue（中英双语）
- 文档：dsh-config/README.md 重写为配置项参考（patch 字段、默认值、用户层覆盖示例）
- 清理：移除 tests/、fixtures/ 与未使用的 icon-svg.ts；英文文档归档到 docs/en/
- 安装方式与 v1.0.3 一致：npm / GitHub / 本地 file: 三种来源

## v1.0.3 (2026-08-23)

- 新增：插件按 dsh Profile Bundle 规范打包，一条命令安装
  `dsh plugin --profile web add github:caob23/dsh-browser-control#v1.0.3`
  （npm 发布后也可 `dsh plugin --profile web add @caob23/dsh-browser-control`）
- 变更：npm 包名从 in-tree 的 `@deepseek-ai/dsh-browser-bridge` 改为用户 scope 的 `@caob23/dsh-browser-control`
- 变更：插件源码上移到仓库根，独立于 harness 工作区构建（tsc + tsdown），构建产物 `lib/` 随仓库提交，GitHub 安装零编译
- 旧「复制进 harness 源码树」方式保留在 v1.0.2 tag；迁移时删除旧副本避免 browser-bridge id 重复挂载

## v1.0.2 (2026-08-23)

16 项验收意见修复，另加饱和回归中新发现并修复的 10 个缺陷。

弹窗与交互：

- 新增 `dialog` 命令：全局自动应答策略（accept / dismiss / manual）读取与切换，含最近 50 条弹窗日志
- MV3 service worker 常驻监听 `Page.javascriptDialogOpening`，alert/confirm/prompt/beforeunload 全类型自动应答，prompt 支持自定义应答文本
- 连续链式弹窗（一次点击多个 prompt）逐个依次应答
- 输入新增 `mode:'type'` 真实键盘通道：逐字符 keyDown/keyUp，回车映射 Enter；默认 fill 模式保持直写

键盘与焦点健壮性：

- 键盘/鼠标事件前自动聚焦目标窗口并激活标签页；**绝不修改窗口尺寸、位置或状态**（含最大化状态），最小化窗口返回结构化 `window_minimized` 错误而非擅自还原
- 非 ASCII 字符（中文/emoji）改走 `Input.insertText` 真实插入通道，不再被协议损坏成 `?`
- 移除多余的 char 事件，修复 ASCII 字符被插入两次
- Enter 事件携带 `text:'\r'`，表单隐式提交恢复正常

求值与序列化：

- 页面导航中断求值时返回结构化 `context_destroyed` 错误（覆盖 -32000 "Inspected target navigated or closed" 变体），不再挂满超时
- 序列化重写为两步架构：先取 RemoteObject 元数据分类，再经 `callFunctionOn` 按值转移；DOM 节点、函数、Map/Set 等不可转移值诚实报错，杜绝静默 `{}`（新版 Chrome returnByValue 行为变更）
- `eval` 支持 `timeoutMs` 竞速超时，慢 Promise 不再拖满桥接默认 60s
- `eval` 支持 `frameSelector` 同源 iframe 求值，document/window 经参数影子化重绑定（修复 TDZ 报错）；`argNames`+`args` 参数化注入

导航与等待：

- 死站点导航返回结构化 `siteUnreachable:{reason:dns|unreachable}`，经页面内 location.href 探测 chrome-error 页，中英文错误文案均可分类
- 新增 `wait` 命令：selector / text / fn 三种条件 50ms 轮询等待，fn 同时接受谓词函数与布尔表达式，timeoutMs 上限 120s

工具输出：

- `click` 返回命中校验（hitVerified）、点击坐标、元素信息及连带应答的弹窗数
- `screenshot` 支持 selector 元素裁剪截图并返回 elementRect
- `tabs.list` 精简为紧凑结构（id/url/title/active 等）
- snapshot 增加 total 计数与每项 type/value/rect 字段

## v1.0.1 (2026-08-23)

- 修复：已连接时圆点显示为绿色呼吸动画（此前因 CSS 类名错位误显示红色）
- 新增：弹窗一键「断开连接」；断开后不再自动重连，点「立即连接」恢复
- 文档：新增鲸鱼插画横幅，README / CONTRIBUTING / SECURITY 中英双语（中文默认）
- 文档：版本号和 License 徽章改为动态读取，徽章换成经典塑料风格

## v1.0.0 (2026-08-22)

- 扩展、弹窗、状态页统一鲸鱼图标
- 状态页内嵌 SVG logo
- 持久 debugger 附着（控制期间 Chrome 横幅稳定显示）
- 配置简化为端口模式（替代完整 URL）
- 状态页暗色卡片样式 + 连接信息展示

## v0.2.0 (2026-08-22)

- 持久 debugger 附着
- 桥接端口配置输入
- 状态页美化
- 29/29 单元测试通过

## v0.1.0 (2026-08-22)

- 首个发布版本
