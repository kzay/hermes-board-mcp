# hermes-board-mcp v3

Standalone MCP server exposing **kanban** and **OpenSpec** tools for the Hermes board system. Agents and Cursor IDE instances connect to this server to list boards, create tasks, validate specs, and push changes — all via the Model Context Protocol over HTTP.

**v3 changes:** Project/repo routing, `kanban_heartbeat`, committed-ref dispatch with portable Git context, `repo` section in `hermes-board.json`.

**v2 changes:** Full Hermes CLI alignment (18 kanban tools), hybrid REST+CLI transport, rewritten `kanban_create` schema, idempotent OpenSpec import.

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
# → {"status":"ok","service":"hermes-board-mcp"}

# 5. Call a tool (loopback — no token required)
curl -X POST http://127.0.0.1:7332/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"kanban_boards_list","arguments":{}}}'
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `7332` | HTTP listen port |
| `BOARD_MCP_TOKENS` | *(empty)* | Comma-separated bearer tokens, optional `:profile` suffix |
| `BOARD_MCP_POLICY` | `./policy.yaml` | Path to tool access policy YAML |
| `BOARD_MCP_REQUIRE_AUTH` | *(unset)* | Set to `always` to require auth on loopback too |
| `HERMES_PROJECTS_BASE` | `/opt/hermes/projects` | Base directory for project metadata |
| `HERMES_OPENSPEC_ROOT` | `~/.hermes/factory/openspec` | Default OpenSpec root when no project is specified |
| `HERMES_KANBAN_API_URL` | `http://127.0.0.1:9119/api/plugins/kanban` | Dashboard plugin REST base URL |
| `HERMES_KANBAN_API_ALLOW_REMOTE` | *(unset)* | Set to `1` to allow non-loopback REST URLs |

## Client Configuration (`hermes-board.json`)

Place a `hermes-board.json` in your repo root for project defaults. The server does not read this file; it is for client skills and IDE workflows.

```json
{
  "config_version": 1,
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
  }
}
```

- `repo` section is used for portable worker dispatch (v3).
- `defaults.workspace` defaults to `scratch` for committed-ref dispatch.

## Hybrid Transport

The server attempts REST calls against the Hermes dashboard plugin when possible (faster, preserves metadata). If the dashboard is unavailable, it falls back to the `hermes` CLI. By default only **loopback** REST URLs are allowed; use `HERMES_KANBAN_API_ALLOW_REMOTE=1` to override.

## MCP Tool Reference

### Kanban tools

| Tool | Description |
|------|-------------|
| `kanban_boards_list` | List all kanban boards |
| `kanban_create_board` | Create a new board |
| `kanban_list` | List tasks, filterable by status |
| `kanban_show` | Show single task details |
| `kanban_create` | Create a task with native Hermes flags |
| `kanban_assign` | Assign a task to a profile |
| `kanban_complete` | Complete a task (→ done) |
| `kanban_block` | Block a task (→ blocked) |
| `kanban_unblock` | Unblock a task (→ ready) |
| `kanban_archive` | Archive a task |
| `kanban_comment` | Add a comment |
| `kanban_link` | Link parent → child |
| `kanban_unlink` | Remove a link |
| `kanban_specify` | Run the specify step |
| `kanban_dispatch` | Dispatch ready tasks to workers |
| `kanban_runs` | Show worker runs for a task |
| `kanban_stats` | Board statistics |
| `kanban_tail` | One-shot tail of task events |
| `kanban_heartbeat` | Send a liveness heartbeat for a long-running task |
| `kanban_create_from_openspec` | Batch-create tasks from OpenSpec change (committed-ref dispatch) |

### OpenSpec tools

| Tool | Description |
|------|-------------|
| `openspec_validate` | Validate an OpenSpec change |
| `openspec_status` | Get status of an OpenSpec change |
| `openspec_list` | List all OpenSpec changes |
| `openspec_push` | Upload change artifacts and auto-validate |

### `kanban_create` schema

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

# OpenSpec metadata (fenced in body):
spec_ref?:              string
acceptance_criteria?:   string
test_command?:          string
human_gate_required?:   "yes" | "no"
```

Native Hermes routing fields (`assignee`, `workspace`, `skills`, etc.) are passed as native CLI flags / REST fields. OpenSpec metadata is fenced inside the task body so it stays machine-parseable without colonizing Hermes's native flags.

### `kanban_create_from_openspec` arguments

```text
board?:                 string (optional if project or repo resolves a board)
change_name:            string (OpenSpec change name)
project?:               string (project slug for routing)
repo?:                  string (repo URL or alias for routing)
base_commit:            string (required Git commit hash for worker checkout)
base_branch?:           string (Git branch name, defaults to project default_branch)
spec_ref?:              string (spec reference, e.g. git ref or tag)
spec_path?:             string (path within repo to the spec directory)
test_command?:          string (command to run tests for this spec)
dependency_strategy?:   "none" (default) | "sequential" | "explicit"
assignee?:              string
workspace?:             "scratch" (default) | "worktree" | /^dir:/
skills?:                string[]
allowed_paths?:         string[] (paths the worker is allowed to modify)
```

Requires `base_commit`. Idempotency keys are derived as `project:change:commit:index` so re-running the same call does not duplicate tasks.

Each created task includes a portable Git context block in its body telling the worker to clone/fetch `repo_url`, checkout `base_commit`, and read `spec_path` inside `$HERMES_KANBAN_WORKSPACE`.

## Authentication

Bearer tokens are configured via `BOARD_MCP_TOKENS`. Each token can optionally bind to a profile:

```
BOARD_MCP_TOKENS="abc123:orchestrator,def456:builder,ghi789"
```

- **Loopback requests** (`127.0.0.1`, `::1`) bypass auth by default.
- Set `BOARD_MCP_REQUIRE_AUTH=always` to enforce auth everywhere.
- Send the token as `Authorization: Bearer <token>`.
- The `X-Hermes-Profile` header identifies the calling agent when no profile is bound to the token.

Send `SIGHUP` to the process to hot-reload tokens without restart.

## Policy

The `policy.yaml` file controls which profiles can call which tools (default-deny). Send `SIGHUP` to hot-reload the policy file.

## Deployment

### Docker Compose

```bash
cd hermes-board-mcp
docker compose up -d
```

### npm global install

```bash
npm install -g @kzay/hermes-board-mcp
hermes-board-mcp start --port 7332 --env-file /etc/hermes/hermes-board-mcp.env
```

### systemd

Copy the provided service file and enable it:

```bash
cp hermes-board-mcp.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now hermes-board-mcp

# View logs
journalctl -u hermes-board-mcp -f
```

## Caddy / TLS (External Access)

Add a site block to your Caddyfile for TLS termination:

```caddyfile
hermes-board-mcp.{$HERMES_VPS_DOMAIN} {
    reverse_proxy 127.0.0.1:7332
    header Access-Control-Allow-Origin "*"
    header Access-Control-Allow-Headers "Authorization, Content-Type, X-Hermes-Profile"
}
```

Then create a DNS A/CNAME record for `hermes-board-mcp.<your-domain>` pointing to your VPS IP.

Test:

```bash
curl https://hermes-board-mcp.example.com/health
```

## Related

- [Client skills package](./client/) — `@kzay/hermes-board-skills` for Cursor IDE
- [AGENTS.md](./AGENTS.md) — automated setup instructions for AI agents
- [Factory architecture](../docs/hermes-factory-architecture.md)
- [Hermes Agent docs](https://hermes-agent.nousresearch.com/docs/)
