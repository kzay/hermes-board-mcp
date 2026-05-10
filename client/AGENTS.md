# @kzay/hermes-board-skills - Agent Instructions

Instructions for AI agents to install and configure canonical Hermes Board skills in a project repository.

## Prerequisites

```bash
npm --version
# Hermes Board MCP server must be running and accessible
```

You need the MCP server URL and a bearer token. Ask the operator or check `/etc/hermes/hermes-board-mcp.env` on the VPS.

## Install

```bash
npm install @kzay/hermes-board-skills
```

Verify the canonical skills were copied:

```bash
ls .cursor/skills/board/hb-deploy/SKILL.md
ls .cursor/skills/board/hb-monitor/SKILL.md
ls .cursor/skills/board/hb-plan/SKILL.md
ls .cursor/skills/board/hb-worker/SKILL.md
ls .cursor/skills/board/hb-release/SKILL.md
```

If the files are missing, run the postinstall manually:

```bash
node node_modules/@kzay/hermes-board-skills/postinstall.js
```

## Configure

### MCP Connection

Check if `.cursor/mcp.json` already has a `hermes-board-mcp` entry:

```bash
cat .cursor/mcp.json 2>/dev/null | grep hermes-board-mcp
```

If not present, create or merge:

```bash
mkdir -p .cursor
cp node_modules/@kzay/hermes-board-skills/hermes-board-mcp.example.json .cursor/mcp.json
```

Edit `.cursor/mcp.json` and replace `YOUR_DOMAIN` with the actual MCP server domain.

### Project Defaults

Create or update `hermes-board.json`:

```bash
cp node_modules/@kzay/hermes-board-skills/hermes-board.example.json hermes-board.json
```

Set `project.slug`, `project.board`, `repo.url`, and any repo aliases. Keep `defaults.workspace` as `scratch` for remote committed-ref dispatch unless the user explicitly wants another Hermes workspace mode.

### Token

Set the `BOARD_MCP_TOKEN` environment variable:

```bash
export BOARD_MCP_TOKEN="your-bearer-token-here"
```

If the token is not available, inform the user:

> A `BOARD_MCP_TOKEN` is required to connect to the Hermes Board MCP server.
> Generate one on the VPS with `openssl rand -hex 24`, then add it to the server's `BOARD_MCP_TOKENS` env var.

## Verify

1. Call the HTTP `/health` endpoint.
2. Call `hb_health` if the profile allows it.
3. Call `hb_list_boards`; an array of boards confirms the connection works.

If you get a 401, the token is wrong or missing.
If you get connection refused, the server is not running or the URL is wrong.

## Skill Selection

- Use `hb-deploy` for provider-backed spec dispatch through `hb_import_spec`.
- Use `hb-monitor` for board summaries and follow workflows.
- Use `hb-plan` for task creation, assignment, links, specify, and dispatch.
- Use `hb-worker` for comments, blockers, unblock, heartbeat, and worker completion.
- Use `hb-release` for release checks, task completion, and archival.

## Troubleshoot

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401 Unauthorized` | Token mismatch | Verify `BOARD_MCP_TOKEN` matches a token in `BOARD_MCP_TOKENS` |
| `Connection refused` | Server not running or wrong URL | Verify `/health` returns 200 |
| Skills not in Cursor | postinstall did not run | Run the package postinstall manually |
| `ENOTFOUND` | Wrong domain in `.cursor/mcp.json` | Check the URL matches the VPS domain |
| MCP tools not listed | `.cursor/mcp.json` missing or malformed | Re-copy the example config and merge carefully |
