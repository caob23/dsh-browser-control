# Security Policy

[简体中文](../../SECURITY.md)

## Permissions requested

The extension requests these Chrome permissions:

| Permission | Purpose |
|---|---|
| `debugger` | Drive pages via CDP (run JS, synthesize input, capture screenshots) |
| `tabs` | Read tab info and manage tab navigation |
| `storage` | Save user configuration (port, token, auto-connect) |
| `alarms` | Keepalive heartbeat for the WebSocket connection |

## Security boundaries

- **Listens on 127.0.0.1 only** — the bridge is never exposed to the network
- **Token authentication** — the extension must present the correct token to connect
- **Local-only communication** — extension and bridge talk over WebSocket on localhost
- **No data upload** — nothing is sent to any external server
- **User control** — the plugin is off by default; enable it manually in dsh Settings
- **Visibility** — Chrome shows its "is being debugged" banner during control; every action is visible on screen

## Known limitations

- The extension can execute arbitrary JavaScript in page contexts via CDP — enable it only on machines you trust
- The `/api/command` endpoint relies on 127.0.0.1 binding for isolation; other processes on the same machine can theoretically call it
- The default token `dsh-local` prevents accidental connections, it is not a security credential; change it if you need stronger isolation

## Reporting a vulnerability

Either channel works:

- **Private report (preferred)**: GitHub Security Advisories (repo Security tab → Report a vulnerability)
- **Public issue**: fine for problems without exploitable details (no concrete attack steps, no token-bypass methods)

For anything exploitable, please use the private channel so it is not abused before a fix ships.
