# @kzay/hermes-board-skills

Canonical `hb-*` Cursor IDE skills for interacting with the Hermes Board MCP Server.

## Install

```bash
npm install @kzay/hermes-board-skills
```

The postinstall script copies the canonical skill suite to `.cursor/skills/board/` without overwriting existing files. It copies whole skill directories, including provider references.

If your package manager skips lifecycle scripts, run the setup command from your project root:

```bash
npx hermes-board-skills-setup
```

```text
.cursor/skills/board/
  hb-deploy/SKILL.md
  hb-deploy/references/providers/openspec.md
  hb-monitor/SKILL.md
  hb-plan/SKILL.md
  hb-worker/SKILL.md
  hb-release/SKILL.md
```

## Skills

| Skill | Description |
|-------|-------------|
| `hb-deploy` | Validate and dispatch provider-backed specs through `hb_import_spec`, subscribe to notifications |
| `hb-monitor` | Check board status, worker logs, task context, board events, assignees, and follow deployed spec work |
| `hb-plan` | Initialize boards, create/edit/organize/assign/link/specify/dispatch board tasks, manage board lifecycle |
| `hb-worker` | Claim tasks, read context, report progress/blockers/liveness, complete with structured metadata |
| `hb-release` | Verify release readiness, bulk complete/archive tasks, garbage-collect workspaces, remove old boards |

## Configure

1. Copy the example MCP config into your project:

```bash
cp node_modules/@kzay/hermes-board-skills/hermes-board-mcp.example.json .cursor/mcp.json
```

2. Edit `.cursor/mcp.json` and replace `YOUR_DOMAIN` with your MCP server domain.

3. Create a `hermes-board.json` in your repo root:

```bash
cp node_modules/@kzay/hermes-board-skills/hermes-board.example.json hermes-board.json
```

4. Set your bearer token as a **system environment variable** (`.env` files are not supported by Cursor for HTTP/SSE MCP servers):

   **macOS / Linux (shell):**
   ```bash
   export HERMES_BOARD_MCP_TOKEN="your-token-here"
   ```

   **Windows (PowerShell, user-scoped):**
   ```powershell
   [System.Environment]::SetEnvironmentVariable("HERMES_BOARD_MCP_TOKEN", "your-token-here", "User")
   ```

   Restart Cursor after setting the variable so it is available to the MCP client.

   Get a token from your VPS operator or generate one on the server with:

```bash
TOKEN=$(openssl rand -hex 24)
# Add the token to BOARD_MCP_TOKENS on the server
```

## Verify

Use the HTTP health endpoint:

```bash
curl https://hermes-board-mcp.yourdomain/health
```

Then invoke `hb_health` or `hb_list_boards` from Cursor. A successful response confirms the MCP connection and token are working.

## Provider Dispatch

`hb-deploy` supports `openspec:<change-name>` for this release. The server registry may know about future provider prefixes, but the client skill treats not-yet-implemented providers as unavailable until the server can build real task bodies for them.

Provider-specific local checks live under each skill's `references/providers/` directory. Top-level skills stay workflow-oriented so new providers do not create routing noise.

## Multi-Project Usage

Each repo gets its own install and `.cursor/mcp.json`, but they can all connect to the same Hermes Board MCP server on the VPS. The server uses the `project` or `repo` argument in tool calls to route to the correct board.

A `hermes-board.json` in the repo root is recommended for project defaults, including `repo` metadata for portable committed-ref dispatch. The default workspace is `scratch` so remote workers clone or fetch from the configured repository.

## Migration

The release skill names use the `hb-*` prefix. Older OpenSpec-named entry points are no longer installed by this package; use `hb-deploy` and `hb-monitor`.

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | Wrong or missing token | Check `HERMES_BOARD_MCP_TOKEN` matches a server token |
| `Connection refused` | Server not running | Verify the `/health` endpoint returns 200 |
| Skills not appearing | postinstall did not run | Run `npx hermes-board-skills-setup` |
| `ENOTFOUND` | Wrong domain in MCP config | Check `.cursor/mcp.json` URL |
| MCP tools not listed | MCP config missing or malformed | Re-copy `hermes-board-mcp.example.json` and merge carefully |
| `envFile` / `.env` ignored | Cursor does not support `.env` for HTTP/SSE servers | Set `HERMES_BOARD_MCP_TOKEN` as a system environment variable and restart Cursor |

## Related

- [Server package](../) - `@kzay/hermes-board-mcp`
- [Agent install instructions](./AGENTS.md)
- [Tool coverage matrix](./TOOL_COVERAGE.md)
