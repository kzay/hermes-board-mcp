# hermes-board-mcp v3.4.0

Standalone MCP server exposing kanban and provider-backed spec import tools for the Hermes board system. Agents and Cursor IDE instances connect to this server to list boards, create tasks, dispatch spec work, and monitor worker progress via the Model Context Protocol over HTTP.

## Current Release

- Canonical `hb_*` MCP tool names.
- Project/repo routing through Hermes project metadata.
- `hb_import_spec` for provider-prefixed spec dispatch, currently supporting `openspec:<change-name>`.
- `hb_health` for MCP-level setup verification.
- `hb_send_heartbeat` for long-running worker liveness.
- `repo` metadata in `hermes-board.json` for portable committed-ref dispatch.
- Server package and client skills package are released together as `3.4.0`.

## Quickstart

```bash
# 1. Install
npm install -g @kzay/hermes-board-mcp

# 2. Generate a bearer token
TOKEN=$(openssl rand -hex 24)
export BOARD_MCP_TOKENS="$TOKEN:orchestrator"

# 3. Start the server
hermes-board-mcp start

# 4. Verify health
curl http://127.0.0.1:7332/health
# -> {"status":"ok","service":"hermes-board-mcp"}

# 5. Call a tool (loopback requests do not require a token by default)
curl -X POST http://127.0.0.1:7332/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"hb_list_boards","arguments":{}}}'
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `7332` | HTTP listen port |
| `BOARD_MCP_TOKENS` | empty | Comma-separated bearer tokens, optional `:profile` suffix |
| `BOARD_MCP_POLICY` | `./policy.yaml` | Path to tool access policy YAML |
| `BOARD_MCP_REQUIRE_AUTH` | unset | Set to `always` to require auth on loopback too |
| `HERMES_PROJECTS_BASE` | `/opt/hermes/projects` | Base directory for project metadata |
| `HERMES_KANBAN_API_URL` | `http://127.0.0.1:9119/api/plugins/kanban` | Dashboard plugin REST base URL |
| `HERMES_KANBAN_API_ALLOW_REMOTE` | unset | Set to `1` to allow non-loopback REST URLs |

## Client Configuration

Place a `hermes-board.json` in your repo root for project defaults. The server does not read this file; it is for client skills and IDE workflows.

```json
{
  "config_version": 1,
  "$schema": "https://hermes-agent.nousresearch.com/schemas/hermes-board.json",
  "server": {
    "url": "https://hermes-board-mcp.example.com/mcp",
    "profile": "orchestrator"
  },
  "project": {
    "slug": "my-project",
    "board": "my-project"
  },
  "repo": {
    "url": "https://github.com/user/repo.git",
    "aliases": ["git@github.com:user/repo.git"],
    "default_branch": "main"
  },
  "defaults": {
    "assignee": "builder",
    "workspace": "scratch",
    "max_runtime": "2h",
    "skills": [],
    "tenant": null,
    "priority": null
  },
  "openspec": {
    "root": "openspec/"
  }
}
```

- `repo` is used for portable worker dispatch.
- `defaults.workspace` defaults to `scratch` for committed-ref dispatch.
- Tokens stay outside this file; use environment variables and MCP headers.

## Hybrid Transport

The server attempts REST calls against the Hermes dashboard plugin when possible. If the dashboard is unavailable, it falls back to the `hermes` CLI. By default only loopback REST URLs are allowed; use `HERMES_KANBAN_API_ALLOW_REMOTE=1` to override.

## MCP Tool Reference

| Tool | Description |
|------|-------------|
| `hb_list_boards` | List all kanban boards |
| `hb_health` | Return MCP server health and dashboard REST status |
| `hb_create_board` | Create a new board |
| `hb_list_tasks` | List tasks, filterable by status |
| `hb_show_task` | Show single task details |
| `hb_create_task` | Create a task with native Hermes flags |
| `hb_assign_task` | Assign a task to a profile |
| `hb_complete_task` | Complete a task |
| `hb_block_task` | Block a task |
| `hb_unblock_task` | Unblock a task |
| `hb_archive_task` | Archive a task |
| `hb_add_comment` | Add a comment |
| `hb_link_tasks` | Link parent to child |
| `hb_unlink_tasks` | Remove a link |
| `hb_specify_task` | Run the specify step |
| `hb_dispatch_tasks` | Dispatch ready tasks to workers |
| `hb_get_runs` | Show worker runs for a task |
| `hb_get_stats` | Board statistics |
| `hb_tail_events` | One-shot tail of task events |
| `hb_send_heartbeat` | Send a liveness heartbeat for a long-running task |
| `hb_import_spec` | Create a provider-backed orchestration task from `spec_ref` |

### `hb_create_task` schema

```text
board:                  string
title:                  string
body?:                  string
assignee?:              string
parents?:               string[]
tenant?:                string
priority?:              number (int)
workspace?:             "scratch" | "worktree" | /^dir:/
triage?:                boolean
idempotency_key?:       string
max_runtime?:           string (e.g. "30m", "2h")
skills?:                string[]

# Metadata fenced in body:
spec_ref?:              string
acceptance_criteria?:   string
test_command?:          string
human_gate_required?:   "yes" | "no"
```

Native Hermes routing fields such as `assignee`, `workspace`, and `skills` are passed as native CLI flags or REST fields. Metadata is fenced inside the task body so it stays machine-parseable without replacing Hermes native fields.

### `hb_import_spec` arguments

```text
spec_ref:               string (provider-prefixed ref, e.g. "openspec:add-auth")
base_commit:            string (required Git commit hash for worker checkout)
board?:                 string (optional if project or repo resolves a board)
project?:               string (project slug for routing)
repo?:                  string (repo URL or alias for routing)
base_branch?:           string (Git branch name, defaults to project default_branch)
assignee?:              string
workspace?:             "scratch" (default) | "worktree" | /^dir:/
skills?:                string[]
allowed_paths?:         string[] (paths the worker is allowed to modify)
```

The provider is selected from `spec_ref`. `openspec:<change>` is supported for OpenSpec changes. The server derives provider-specific paths, creates one orchestration task, and does not read local spec files from the client checkout.

Requires `base_commit`. Idempotency keys are derived from the resolved project, `spec_ref`, and commit so re-running the same call does not duplicate the orchestration task.

Each created task includes portable Git context telling the worker which repository, branch, commit, provider, and provider-derived path to use inside `$HERMES_KANBAN_WORKSPACE`.

## Authentication

Bearer tokens are configured via `BOARD_MCP_TOKENS`. Each token can optionally bind to a profile:

```bash
BOARD_MCP_TOKENS="abc123:orchestrator,def456:builder,ghi789"
```

- Loopback requests (`127.0.0.1`, `::1`) bypass auth by default.
- Set `BOARD_MCP_REQUIRE_AUTH=always` to enforce auth everywhere.
- Send the token as `Authorization: Bearer <token>`.
- The `X-Hermes-Profile` header identifies the calling agent when no profile is bound to the token.

Send `SIGHUP` to the process to hot-reload tokens without restart.

## Policy

The `policy.yaml` file controls which profiles can call which tools. It is default-deny and can be hot-reloaded with `SIGHUP`.

## Deployment

### Docker Compose

```bash
cd hermes-board-mcp
docker compose up -d
```

### npm Global Install

```bash
npm install -g @kzay/hermes-board-mcp
hermes-board-mcp start --port 7332 --env-file /etc/hermes/hermes-board-mcp.env
```

### systemd

```bash
cp server/hermes-board-mcp.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now hermes-board-mcp
journalctl -u hermes-board-mcp -f
```

For a global npm install, the packaged service file can also be copied from the package directory:

```bash
cp $(npm root -g)/@kzay/hermes-board-mcp/hermes-board-mcp.service /etc/systemd/system/
```

## Caddy / TLS

```caddyfile
hermes-board-mcp.{$HERMES_VPS_DOMAIN} {
    reverse_proxy 127.0.0.1:7332
    header Access-Control-Allow-Origin "*"
    header Access-Control-Allow-Headers "Authorization, Content-Type, X-Hermes-Profile"
}
```

Then create a DNS A/CNAME record for `hermes-board-mcp.<your-domain>` pointing to your VPS IP.

```bash
curl https://hermes-board-mcp.example.com/health
```

## Release Verification

```bash
npm run release:check
```

This runs the TypeScript build, stale-name checks for release-facing files, client skill quality checks, and package dry runs that verify required production files.

## Related

- [Client skills package](./client/) - `@kzay/hermes-board-skills` for Cursor IDE
- [AGENTS.md](./AGENTS.md) - automated setup instructions for AI agents
- [Hermes Agent docs](https://hermes-agent.nousresearch.com/docs/)
