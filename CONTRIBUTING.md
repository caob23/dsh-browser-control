# 贡献指南

[English](docs/en/CONTRIBUTING.en.md)

## 开发流程

1. Clone deepseek-harness 仓库
2. 把 `plugin/` 复制到 `packages/web/browser-bridge/`
3. 运行 `pnpm install && pnpm run build`
4. 运行测试：`pnpm exec vitest run packages/web/browser-bridge`

## 扩展开发

1. 在 `chrome://extensions` 以「加载已解压的扩展程序」方式加载 `extension/`
2. 在 dsh 设置 → 插件中启用 DSH 浏览器控制
3. 通过 `http://127.0.0.1:9777/` 测试命令

## 提交规范

- 一个 PR 只做一件事，拆分独立改动
- 提交信息用英文，格式：`feat: xxx` / `fix: xxx` / `docs: xxx`
- 改动插件代码必须跑通 29 个单元测试

## 报告问题

提 Issue 时请附上：dsh 版本、Chrome 版本、桥接状态页（`http://127.0.0.1:9777/`）的输出。
