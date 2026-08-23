# dsh 配置参考

安装方式见 [README](../README.md)。本文只说明插件的配置项含义，供需要自定义默认值的用户参考。

## cordis.patch.yml 字段

插件包根目录的 `cordis.patch.yml` 声明默认配置：

```yaml
- insert:
    - id: browser-bridge
      name: '@caob23/dsh-browser-control'
      config:
        enabled: false
        port: 9777
        token: dsh-local
```

| 字段 | 默认值 | 说明 |
|---|---|---|
| `id` | `browser-bridge` | 插件实例 ID，勿改 |
| `name` | `@caob23/dsh-browser-control` | npm 包名，即 Loader 的解析目标 |
| `config.enabled` | `false` | 默认关闭，在 dsh 设置 → 插件 → DSH 浏览器控制 手动开启 |
| `config.port` | `9777` | 本地桥接服务端口（127.0.0.1，仅监听回环） |
| `config.token` | `dsh-local` | 扩展与桥接的握手令牌；多用户环境建议改掉 |

## 覆盖默认值

不想改包内文件的话，在你的 profile 用户层（`$DSH_HOME/profiles/<名字>/cordis.patch.yml`）里写一条补丁覆盖 `browser-bridge` 的 config 即可，例如改端口：

```yaml
- merge:
    - id: browser-bridge
      config:
        port: 8888
```

## 状态页

桥接启动后可访问 `http://127.0.0.1:9777/` 查看连接状态；扩展工具栏图标绿点呼吸 = 已连接。
