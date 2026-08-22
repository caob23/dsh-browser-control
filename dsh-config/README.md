# 接入 dsh 配置说明

## 一键安装

```bash
git clone https://github.com/caob23/dsh-browser-control.git
cd dsh-browser-control
./install.sh /你的路径/deepseek-harness
```

脚本会把 `plugin/` 复制到 `packages/web/browser-bridge/`，然后你还需要手动改三处配置。

## 手动安装

把 `plugin/` 目录复制到 `deepseek-harness/packages/web/browser-bridge/`，然后改三个文件：

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
