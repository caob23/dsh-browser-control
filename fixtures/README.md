# 自测夹具（Fixtures）

离线可跑的 1:1 复刻页面，用于验证插件核心能力，不依赖任何外部测试站
（demo.seleniumeasy.com、the-internet.herokuapp.com 均已永久下线）。

## 用法

```bash
# 直接用浏览器打开，或起一个静态服务
npx serve fixtures/
# 然后让 Agent 通过 browser_* 工具操作 file:/// 或 http://127.0.0.1 路径
```

| 文件 | 验证能力 |
|---|---|
| `fixture_sum.html` | 表单输入 + 按钮点击 + 结果读取（两数求和） |
| `fixture_alerts.html` | alert / confirm / prompt 原生弹窗自动应答 |
| `fixture_iframe.html` | iframe 内输入 → 退出帧 → 外层按钮跨帧回读 |

## 行为契约要点

- `fixture_sum.html` 的结果元素在点击后才渲染——验证 `browser_wait` 显式等待
- `fixture_alerts.html` 需要 v1.0.2+ 的弹窗自动应答（默认 accept 策略）
- `fixture_iframe.html` 是同源帧；跨源 OOPIF 场景暂不支持，会报结构化错误
