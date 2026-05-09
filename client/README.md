# @kzay/hermes-board-skills

Cursor IDE skills for interacting with the **Hermes Board MCP Server**. Provides `openspec-deploy` and `openspec-monitor` skills that connect to the `hermes-board-mcp` server's kanban and OpenSpec tools.

## Install

```bash
npm install @kzay/hermes-board-skills
```

The postinstall script copies skill files to `.cursor/skills/board/`:

```
.cursor/skills/board/
├── openspec-deploy/SKILL.md
└── openspec-monitor/SKILL.md
```

## Skills

| Skill | Description | Triggers |
|-------|-------------|----------|
| `openspec-deploy` | Validate and dispatch a committed OpenSpec change to Hermes Kanban | "deploy spec", "push openspec", "create tasks from spec", "dispatch this change" |
| `openspec-monitor` | Check kanban board status and OpenSpec changes | "board status", "check factory", "kanban overview" |

## Configure

1. Copy the example MCP config into your project:

```bash
cp node_modules/@kzay/hermes-board-skills/hermes-board-mcp.example.json .cursor/mcp.json
```

2. Edit `.cursor/mcp.json` — replace `YOUR_DOMAIN` with your VPS domain.

3. Create a `hermes-board.json` in your repo root for project defaults:

```bash
cp node_modules/@kzay/hermes-board-skills/hermes-board.example.json hermes-board.json
```

4. Set your bearer token as an environment variable:

```bash
export BOARD_MCP_TOKEN="your-token-here"
```

Get a token from your VPS operator or generate one on the server with:

```bash
TOKEN=$(openssl rand -hex 24)
# Add to BOARD_MCP_TOKENS on the server
```

## Verify

Open Cursor and invoke the `kanban_boards_list` MCP tool. You should see a list of boards from your factory.

## Multi-Project Usage

Each repo gets its own install and `.cursor/mcp.json`, but they all connect to the same hermes-board-mcp server on the VPS. The server uses the `project` or `repo` parameter in tool calls to route to the correct project's kanban board.

A `hermes-board.json` in the repo root is recommended for project defaults including `repo` metadata for portable committed-ref dispatch.

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | Wrong or missing token | Check `BOARD_MCP_TOKEN` env var matches a token in the server's `BOARD_MCP_TOKENS` |
| `Connection refused` | Server not running | Verify `curl https://hermes-board-mcp.yourdomain/health` returns 200 |
| Skills not appearing | postinstall didn't run | Run `node node_modules/@kzay/hermes-board-skills/postinstall.js` manually |
| `ENOTFOUND` | Wrong domain in MCP config | Check `.cursor/mcp.json` URL matches your VPS domain |

## Related

- [Server package](../) — `@kzay/hermes-board-mcp`
- [AGENTS.md](./AGENTS.md) — automated setup instructions for AI agents
- [Hermes Factory docs](../../docs/hermes-factory-architecture.md)
