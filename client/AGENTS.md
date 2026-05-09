# @kzay/hermes-board-skills — Agent Instructions

Instructions for AI agents to install and configure factory skills in a project repository.

## Prerequisites

```bash
npm --version     # any recent npm
# Factory MCP server must be running and accessible
```

You need the hermes-board-mcp server URL and a bearer token. Ask the operator or check `/etc/hermes/hermes-board-mcp.env` on the VPS.

## Install

```bash
npm install @kzay/hermes-board-skills
```

Verify the skills were copied:

```bash
ls .cursor/skills/board/openspec-deploy/SKILL.md
ls .cursor/skills/board/openspec-monitor/SKILL.md
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

Edit `.cursor/mcp.json` — replace `YOUR_DOMAIN` with the actual hermes-board-mcp domain.

### Token

Set the `BOARD_MCP_TOKEN` environment variable:

```bash
export BOARD_MCP_TOKEN="your-bearer-token-here"
```

If the token is not available, inform the user:

> A `BOARD_MCP_TOKEN` is required to connect to the factory MCP server.
> Generate one on the VPS: `openssl rand -hex 24`
> Then add it to the server's `BOARD_MCP_TOKENS` env var.

## Verify

Call the `kanban_boards_list` MCP tool. A successful response (array of boards) confirms the connection works.

If you get a 401: the token is wrong or missing.
If you get connection refused: the server is not running or the URL is wrong.

## Troubleshoot

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401 Unauthorized` | Token mismatch | Verify `BOARD_MCP_TOKEN` matches a token in the server's `BOARD_MCP_TOKENS` |
| `Connection refused` | Server not running or wrong URL | Verify `curl https://hermes-board-mcp.yourdomain/health` returns 200 |
| Skills not in Cursor | postinstall didn't run | Run `node node_modules/@kzay/hermes-board-skills/postinstall.js` |
| `ENOTFOUND` | Wrong domain in `.cursor/mcp.json` | Check the URL matches the VPS domain |
| MCP tools not listed | `.cursor/mcp.json` missing or malformed | Re-copy from `hermes-board-mcp.example.json` |
