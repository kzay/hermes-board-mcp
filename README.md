# Hermes Board MCP

[![npm: server](https://img.shields.io/npm/v/@kzay/hermes-board-mcp?label=server)](https://www.npmjs.com/package/@kzay/hermes-board-mcp)
[![npm: skills](https://img.shields.io/npm/v/@kzay/hermes-board-skills?label=skills)](https://www.npmjs.com/package/@kzay/hermes-board-skills)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-339933)](./server/package.json)
[![CI](https://github.com/kzay/hermes-board-mcp/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/kzay/hermes-board-mcp/actions/workflows/ci.yml)

Open-source infrastructure for running agent work through the Hermes board system.

Hermes Board MCP gives Cursor, Claude Code, and other MCP-capable agents a clean HTTP interface for Hermes kanban boards. Agents can create tasks, assign work, dispatch provider-backed specs, send heartbeats, follow worker runs, and close verified work without shelling into the Hermes host.

## Why This Exists

Most agent workflows break down when work leaves one chat: tasks are scattered, progress is hard to see, and long-running workers have no shared control plane. Hermes Board MCP turns the Hermes board into that control plane.

Use it when you want:

- A shared kanban surface for human and AI operators.
- MCP tools for creating, assigning, linking, blocking, unblocking, and completing tasks.
- Provider-backed dispatch through `hb_import_spec`, supporting `openspec:<change-name>` and `speckit:<identifier>` providers with configurable base paths.
- Portable worker instructions pinned to a Git repo, branch, and committed `base_commit`.
- Cursor-ready `hb-*` skills that guide deploy, monitor, plan, worker, and release workflows.

## Packages

This repository publishes two public npm packages together:

| Package | Purpose |
|---------|---------|
| [`@kzay/hermes-board-mcp`](https://www.npmjs.com/package/@kzay/hermes-board-mcp) | MCP server that runs beside the Hermes agent on the VPS |
| [`@kzay/hermes-board-skills`](https://www.npmjs.com/package/@kzay/hermes-board-skills) | Cursor skill suite for developers and operators |

The server belongs on the same machine as Hermes. The skills belong in each developer or project repository that needs to talk to that server.

## Support This Project

Hermes Board MCP is open source, and support from users matters. The easiest ways to help are:

- Star the repository if the project is useful.
- Open issues with clear reproduction steps, logs, and expected behavior.
- Share real workflow feedback: where setup is confusing, where tools are missing, and where agent handoffs fail.
- Improve docs, examples, policies, provider integrations, and test coverage.
- Send focused pull requests that solve one problem at a time.

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the contribution process and [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) for community expectations.

## Quick Start

### 1. Install the Server

Run this on the same host as the Hermes agent:

```bash
npm install -g @kzay/hermes-board-mcp
```

The host must have:

- Node.js 20 or newer.
- The Hermes agent installed.
- The `hermes kanban` command available.

### 2. Create a Token

```bash
TOKEN=$(openssl rand -hex 24)
export BOARD_MCP_TOKENS="$TOKEN:orchestrator"
```

Tokens can be scoped to a profile with `token:profile`. Keep the token out of committed files.

### 3. Start the Server

```bash
hermes-board-mcp start
```

By default the server listens on `127.0.0.1:7332`.

### 4. Check Health

```bash
curl http://127.0.0.1:7332/health
```

Expected response:

```json
{"status":"ok","service":"hermes-board-mcp","version":"<installed-version>"}
```

### 5. Call a Tool

Loopback requests do not require a token unless `BOARD_MCP_REQUIRE_AUTH=always` is set.

```bash
curl -X POST http://127.0.0.1:7332/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"hb_list_boards","arguments":{}}}'
```

## Client Setup for Cursor

Install the companion skill package in any project that should use the board:

```bash
npm install @kzay/hermes-board-skills
```

The postinstall script copies the canonical board skills into:

```text
.cursor/skills/board/
  hb-deploy/
  hb-monitor/
  hb-plan/
  hb-worker/
  hb-release/
```

If lifecycle scripts were skipped, run:

```bash
npx hermes-board-skills-setup
```

### Configure MCP

Copy the example MCP config:

```bash
cp node_modules/@kzay/hermes-board-skills/hermes-board-mcp.example.json .cursor/mcp.json
```

Then set the token as a system environment variable. Cursor does not load `.env` files for HTTP/SSE MCP server headers.

macOS and Linux:

```bash
export HERMES_BOARD_MCP_TOKEN="your-token-here"
```

Windows PowerShell:

```powershell
[System.Environment]::SetEnvironmentVariable("HERMES_BOARD_MCP_TOKEN", "your-token-here", "User")
```

Restart Cursor after setting the variable.

### Configure Project Defaults

Create a `hermes-board.json` in the project root:

```bash
cp node_modules/@kzay/hermes-board-skills/hermes-board.example.json hermes-board.json
```

Example:

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
  },
  "speckit": {
    "root": "speckit/"
  }
}
```

The server does not read this file directly. It is used by client skills and IDE workflows to provide project defaults, repo metadata, and portable dispatch context.

## How It Works

Hermes Board MCP runs beside the Hermes agent and talks to the board through two local channels:

| Channel | Target | Use |
|---------|--------|-----|
| REST | `http://127.0.0.1:9119/api/plugins/kanban` | Preferred path when the dashboard plugin is available |
| CLI | `hermes kanban *` | Fallback path when REST is unavailable |

Remote REST URLs are blocked by default. Set `HERMES_KANBAN_API_ALLOW_REMOTE=1` only when you intentionally want to allow them.

## Core Tools

| Tool | Description |
|------|-------------|
| `hb_health` | Check MCP server and dashboard REST health |
| `hb_list_boards` | List kanban boards |
| `hb_create_board` | Create a board |
| `hb_list_tasks` | List tasks by board and status |
| `hb_show_task` | Show task details |
| `hb_create_task` | Create a task with native Hermes routing fields |
| `hb_assign_task` | Assign a task to a worker profile |
| `hb_link_tasks` | Link parent and child tasks |
| `hb_specify_task` | Run the specify step |
| `hb_dispatch_tasks` | Dispatch ready tasks to workers |
| `hb_get_runs` | Show worker runs for a task |
| `hb_tail_events` | Tail recent task events |
| `hb_send_heartbeat` | Report liveness for long-running work |
| `hb_block_task` / `hb_unblock_task` | Mark work blocked or unblocked |
| `hb_complete_task` | Complete verified work |
| `hb_archive_task` | Archive completed tasks |
| `hb_add_comment` | Add task comments |
| `hb_get_stats` | Get board statistics |
| `hb_import_spec` | Create provider-backed orchestration work from `spec_ref` |

### Provider Dispatch

`hb_import_spec` creates one orchestration task from a provider-prefixed spec reference.

```text
spec_ref:        "openspec:add-auth" or "speckit:feature/42"
base_commit:     required Git commit hash
project:         optional project slug
repo:            optional repo URL or alias
base_branch:     optional branch, defaults to project default_branch
workspace:       "scratch" by default
allowed_paths:   optional path allowlist
spec_base_path:  optional provider root override used for spec_path derivation
```

Supported providers:
- `openspec:<change-name>` — resolves to `openspec/changes/<change-name>/` by convention.
- `speckit:<identifier>` — resolves to `speckit/specs/<identifier>/` by convention.

Both providers support project-level root overrides via the `spec_base_path` parameter or `hermes-board.json` config (`openspec.root` / `speckit.root`). For example, `spec_base_path: "custom-speckit/"` with `speckit:feature/42` resolves to `custom-speckit/specs/feature/42/`. When not specified, convention defaults apply.

The created task includes the Git repository, branch, commit, provider, and provider-derived path so a remote worker can reproduce the intended checkout.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `7332` | HTTP listen port |
| `BOARD_MCP_TOKENS` | empty | Comma-separated bearer tokens, optionally suffixed with `:profile` |
| `BOARD_MCP_POLICY` | `./policy.yaml` | Default-deny tool access policy |
| `BOARD_MCP_REQUIRE_AUTH` | unset | Set to `always` to require auth on loopback |
| `HERMES_PROJECTS_BASE` | `/opt/hermes/projects` | Base directory for Hermes project metadata |
| `HERMES_KANBAN_API_URL` | `http://127.0.0.1:9119/api/plugins/kanban` | Dashboard plugin REST base URL |
| `HERMES_KANBAN_API_TOKEN` | empty | Optional bearer token for dashboard REST calls |
| `HERMES_KANBAN_API_ALLOW_REMOTE` | unset | Set to `1` to allow non-loopback REST URLs |

`policy.yaml` controls which profiles may call which tools. It is default-deny and can be hot-reloaded with `SIGHUP` on Linux and macOS. On Windows, restart the process.

## Deployment

### npm Global Install

```bash
npm install -g @kzay/hermes-board-mcp
hermes-board-mcp start --port 7332 --env-file /etc/hermes/hermes-board-mcp.env
```

### Docker Compose

The included `docker-compose.yml` expects an external `hermes` Docker network and host-mounted Hermes data:

```bash
docker compose up -d
```

### Caddy / TLS

```caddyfile
hermes-board-mcp.{$HERMES_VPS_DOMAIN} {
    reverse_proxy 127.0.0.1:7332
    header Access-Control-Allow-Origin "*"
    header Access-Control-Allow-Headers "Authorization, Content-Type, X-Hermes-Profile"
}
```

Then point `hermes-board-mcp.<your-domain>` at the VPS and verify:

```bash
curl https://hermes-board-mcp.example.com/health
```

## Development

This is a two-package monorepo without npm workspaces. Root scripts delegate to `server/`.

```bash
npm install --prefix server
npm run build
npm test
npm run release:check
```

Useful commands:

| Command | Description |
|---------|-------------|
| `npm run build` | Build the server TypeScript package |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm test` | Run server unit tests |
| `npm run test:e2e:up` | Start the Docker E2E environment |
| `npm run test:e2e` | Run E2E tests |
| `npm run test:e2e:down` | Stop the E2E environment |
| `npm run release:check` | Build, validate release-facing files, and dry-run package checks |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `401 Unauthorized` | Token missing or wrong | Verify `HERMES_BOARD_MCP_TOKEN` matches `BOARD_MCP_TOKENS` |
| `Connection refused` | Server is not running or URL is wrong | Check `/health` and the configured MCP URL |
| Tools are not listed in Cursor | `.cursor/mcp.json` missing or malformed | Re-copy the example config and restart Cursor |
| `.env` token is ignored | Cursor does not load `.env` for HTTP/SSE server headers | Set a system environment variable |
| All kanban operations fail | Server is not co-located with Hermes | Run the MCP server on the Hermes host |
| `hb_import_spec` rejects | Missing `base_commit` or unresolved project/repo | Pass a committed Git hash and valid project or board metadata |
| Policy denies a tool | Profile is not allowed in `policy.yaml` | Update policy and send `SIGHUP` or restart |

## Contributing

Contributions are welcome. Please keep changes focused, documented, and tested.

```bash
npm test
npm run release:check
npm audit --omit=dev
```

Pull requests should follow conventional commits, update docs for user-facing changes, and include the relevant test evidence. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the full checklist.

## License

MIT. See [`LICENSE`](./LICENSE).

## Related

- [`server/`](./server/) - source package for `@kzay/hermes-board-mcp`
- [`client/`](./client/) - source package for `@kzay/hermes-board-skills`
- [`AGENTS.md`](./AGENTS.md) - concise instructions for AI agents working in this repo
- [Hermes Agent docs](https://hermes-agent.nousresearch.com/docs/)
