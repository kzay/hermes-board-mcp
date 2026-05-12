# @kzay/hermes-board-mcp v3.4.0 — Server Agent Instructions

MCP server for the Hermes board system. For client skills: `../client/AGENTS.md`

## Safety Rules

1. **Never install or upgrade** system packages without explicit user confirmation — report what is needed and stop
2. **Never overwrite** `env`, `policy.yaml`, `Caddyfile`, or systemd units without showing the diff
3. **Never delete boards or mass-archive tasks** unless explicitly requested
4. **Never expose tokens** in logs, output, or commits

## Co-location Constraint

The server **must** run on the same host as the Hermes agent. Both channels are loopback-only:

| Channel | Target | Purpose |
|---------|--------|---------|
| CLI | `hermes kanban *` | Filesystem kanban (always available) |
| REST | `http://127.0.0.1:9119` | Dashboard plugin (optional, faster) |

## Prerequisites

If any check fails, report the failure and stop. Do not install anything automatically.

```bash
node --version          # >= 20 required
hermes --version        # agent must be installed on this host
hermes kanban --help    # kanban subcommand must exist
```

## Install

```bash
npm install -g @kzay/hermes-board-mcp
hermes-board-mcp --version    # expected: 3.4.0
```

From source: `cd server && npm install && npm run build && node dist/src/cli.js --version`

## Configure

All config goes in a single env file:

```bash
mkdir -p /etc/hermes
TOKEN=$(openssl rand -hex 24)
echo "BOARD_MCP_TOKENS=$TOKEN:orchestrator" >> /etc/hermes/hermes-board-mcp.env
echo "PORT=7332" >> /etc/hermes/hermes-board-mcp.env
```

Record `$TOKEN` — clients need it. If lost, generate a new one.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `7332` | HTTP listen port |
| `BOARD_MCP_TOKENS` | *(none)* | `token:profile` pairs, comma-separated |
| `BOARD_MCP_POLICY` | `./policy.yaml` | Default-deny tool access policy |
| `BOARD_MCP_REQUIRE_AUTH` | *(unset)* | Set to `always` to require auth on loopback |
| `HERMES_KANBAN_API_URL` | `http://127.0.0.1:9119/...` | Dashboard REST endpoint |
| `HERMES_KANBAN_API_TOKEN` | *(none)* | Bearer token for dashboard REST calls |

- **SIGHUP** hot-reloads tokens + policy (Linux/macOS only; Windows: restart process)

For dashboard integration, policy customization, Caddy, and systemd, see `../README.md`.

## Verify

```bash
hermes-board-mcp start --env-file /etc/hermes/hermes-board-mcp.env &
curl -sf http://127.0.0.1:7332/health
# Expected: {"status":"ok","service":"hermes-board-mcp"}
```

Then call `hb_health` and `hb_list_boards` to confirm kanban connectivity.

## Troubleshoot

| Symptom | Fix |
|---------|-----|
| `command not found` | Add `$(npm bin -g)` to `$PATH` |
| `EADDRINUSE` | Stop conflicting process on port 7332 |
| Health returns 401 | Check token or set `BOARD_MCP_REQUIRE_AUTH=always` |
| All kanban ops fail | Server must be co-located with Hermes agent |
| Policy denies all tools | Add profile to `policy.yaml`, then SIGHUP or restart |
| `hb_import_spec` rejects | Missing `base_commit` or commit not pushed to remote |

Client skills (`@kzay/hermes-board-skills`): see `../client/AGENTS.md`. Generate a starter config: `hermes-board-mcp init > hermes-board-mcp.json`
