# 更新日志

## v1.0.2 (2026-08-23)

16 项验收意见修复，另加饱和回归中新发现并修复的 10 个缺陷。

弹窗与交互：

- 新增 `dialog` 命令：全局自动应答策略（accept / dismiss / manual）读取与切换，含最近 50 条弹窗日志
- MV3 service worker 常驻监听 `Page.javascriptDialogOpening`，alert/confirm/prompt/beforeunload 全类型自动应答，prompt 支持自定义应答文本
- 连续链式弹窗（一次点击多个 prompt）逐个依次应答
- 输入新增 `mode:'type'` 真实键盘通道：逐字符 keyDown/keyUp，回车映射 Enter；默认 fill 模式保持直写

键盘与焦点健壮性：

- 键盘/鼠标事件前自动激活目标标签页及其窗口；最小化窗口先还原（0×0 视口会让所有坐标落屏外）
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
