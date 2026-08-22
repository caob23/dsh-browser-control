# Contributing

## Development

1. Clone the deepseek-harness repo
2. Copy plugin/ into packages/web/browser-bridge/
3. Run pnpm install && pnpm run build
4. Run tests: pnpm exec vitest run packages/web/browser-bridge

## Extension Development

1. Load extension/ as unpacked in chrome://extensions
2. Enable the plugin in dsh Settings → Plugins
3. Test commands via http://127.0.0.1:9777/