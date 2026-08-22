# browser-bridge 插件接入 dsh 的配置补丁
# 将以下行添加到你的 cordis.patch.yml（base 或 web-app bundle）中

# === 1. Bundle patch 补丁（加入插件挂载行） ===
# 在 cordis.patch.yml 的 plugins 列表中添加：
- id: browser-bridge
  name: '@deepseek-ai/dsh-browser-bridge'
  config:
    enabled: false

# === 2. Bundle package.json 依赖（加入包引用） ===
# 在 packages/bundle/base/package.json 的 dependencies 中添加：
# "@deepseek-ai/dsh-browser-bridge": "workspace:^"

# === 3. tsconfig.host.json 引用（加入类型检查） ===
# 在 tsconfig.host.json 的 references 中添加：
# { "path": "./packages/web/browser-bridge" }
