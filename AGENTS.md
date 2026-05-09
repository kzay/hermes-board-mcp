# hermes-board-mcp v3 — Agent Instructions

Instructions for AI agents to install, configure, and verify the hermes-board-mcp server on a VPS.

## Prerequisites

Verify each before proceeding:

```bash
node --version    # must be >= 20.0.0
hermes --version  # must have kanban subcommand
openspec --version  # installed at ~/.local/bin/openspec
```

If `hermes` is missing, install it following https://hermes-agent.nousresearch.com/docs/.
If `openspec` is missing: `npm install -g @fission-ai/openspec@1.3.1`.

## Install

```bash
npm install -g @kzay/hermes-board-mcp
hermes-board-mcp --version
```

If the global install is not possible, run from source:

```bash
cd /opt/hermes/hermes-board-mcp
npm install
npm run build
node dist/src/cli.js --version
```

## Configure

### Generate a bearer token

```bash
TOKEN=$(openssl rand -hex 24)
echo "BOARD_MCP_TOKENS=$TOKEN:orchestrator" >> /etc/hermes/hermes-board-mcp.env
echo "PORT=7332" >> /etc/hermes/hermes-board-mcp.env
```

Record the token value — clients will need it.

### Policy file

The default `policy.yaml` ships with the package. To customize:

```bash
cp $(npm root -g)/@kzay/hermes-board-mcp/policy.yaml /etc/hermes/hermes-board-mcp-policy.yaml
echo "BOARD_MCP_POLICY=/etc/hermes/hermes-board-mcp-policy.yaml" >> /etc/hermes/hermes-board-mcp.env
```

### Dashboard integration (optional)

If the Hermes dashboard plugin is running, the MCP server uses REST for faster operations:

```bash
echo "HERMES_KANBAN_API_URL=http://127.0.0.1:9119/api/plugins/kanban" >> /etc/hermes/hermes-board-mcp.env
# Only set ALLOW_REMOTE=1 if the dashboard is behind a trusted reverse proxy
# echo "HERMES_KANBAN_API_ALLOW_REMOTE=1" >> /etc/hermes/hermes-board-mcp.env
```

## Verify

```bash
hermes-board-mcp start --env-file /etc/hermes/hermes-board-mcp.env &
sleep 2
curl -s http://127.0.0.1:7332/health
# Expected: {"status":"ok","service":"hermes-board-mcp"}
kill %1
```

## Systemd (Persistent Service)

```bash
cp $(npm root -g)/@kzay/hermes-board-mcp/hermes-board-mcp.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now hermes-board-mcp
systemctl status hermes-board-mcp
journalctl -u hermes-board-mcp --no-pager -n 20
```

## Caddy (External TLS Access)

Add to Caddyfile:

```caddyfile
hermes-board-mcp.{$HERMES_VPS_DOMAIN} {
    reverse_proxy 127.0.0.1:7332
    header Access-Control-Allow-Origin "*"
    header Access-Control-Allow-Headers "Authorization, Content-Type, X-Hermes-Profile"
}
```

Then:

```bash
# Create DNS A record for hermes-board-mcp.$HERMES_VPS_DOMAIN → VPS IP
caddy reload --config /etc/caddy/Caddyfile

# Test external access
curl -H "Authorization: Bearer $TOKEN" https://hermes-board-mcp.$HERMES_VPS_DOMAIN/health
```

## Troubleshoot

| Symptom | Cause | Fix |
|---------|-------|-----|
| `EADDRINUSE` | Port 7332 already in use | Check `lsof -i :7332`, stop conflicting process |
| `hermes: command not found` | hermes CLI not in PATH | Add hermes install dir to PATH in env file |
| `openspec: command not found` | openspec not in PATH | Ensure `~/.local/bin` is in PATH |
| Policy denies all tools | Profile not in policy.yaml | Add the profile to `policy.yaml`, send SIGHUP |
| Health returns 401 | Auth required but no token sent | Loopback should bypass — check `BOARD_MCP_REQUIRE_AUTH` |
| Slow kanban operations | Dashboard plugin not running; CLI fallback used | Start `hermes dashboard` or check `HERMES_KANBAN_API_URL` |
| `kanban_create_from_openspec` rejects dispatch | Missing `base_commit` or commit not reachable from remote | Ensure the spec is committed and pushed to a reachable ref |
