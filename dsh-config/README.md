# 接入 dsh 配置说明

如果不用 `install.sh` 一键安装，需要手动改三个文件。

## 1. cordis.patch.yml

在 `packages/bundle/base/cordis.patch.yml` 的 plugins 列表中添加：

```yaml
- id: browser-bridge
  name: '@deepseek-ai/dsh-browser-bridge'
  config:
    enabled: false
```

默认 `enabled: false`，用户在设置页手动开启。

## 2. package.json

在 `packages/bundle/base/package.json` 的 dependencies 中添加：

```json
"@deepseek-ai/dsh-browser-bridge": "workspace:^"
```

## 3. tsconfig.host.json

在 `tsconfig.host.json` 的 references 中添加：

```json
{ "path": "./packages/web/browser-bridge" }
```

## 4. 重启 dsh

重启后设置页会出现「DSH 浏览器控制」卡片，开启即可。
