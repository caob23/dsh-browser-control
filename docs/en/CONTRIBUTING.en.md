# Contributing

[简体中文](../../CONTRIBUTING.md)

## Development workflow

1. Clone the deepseek-harness repo
2. Copy `plugin/` into `packages/web/browser-bridge/`
3. Run `pnpm install && pnpm run build`
4. Run tests: `pnpm exec vitest run packages/web/browser-bridge`

## Extension development

1. Load `extension/` unpacked via `chrome://extensions`
2. Enable DSH Browser Control in dsh Settings → Plugins
3. Test commands via `http://127.0.0.1:9777/`

## Commit conventions

- One PR, one concern; split independent changes
- Commit messages in English: `feat: xxx` / `fix: xxx` / `docs: xxx`
- Plugin code changes must keep all 29 unit tests passing

## Reporting issues

When filing an issue, include: dsh version, Chrome version, and the output of the status page (`http://127.0.0.1:9777/`).
