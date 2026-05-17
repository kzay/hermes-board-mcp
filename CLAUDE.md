# hermes-board-mcp

## Overview

This is a monorepo for the Hermes board system. For deployment/usage instructions, see `server/AGENTS.md` (MCP server) or `client/AGENTS.md` (client skills).

## Tech Stack

- **Language:** TypeScript (Node.js)
- **Framework:** MCP SDK
- **Architecture:** MCP Server (StreamableHTTP transport)

## Key Dependencies

- `@modelcontextprotocol/sdk` — MCP SDK
- `zod` — schema validation
- `js-yaml` — policy/config parsing

## Development Conventions

- TypeScript `strict` mode, `module: NodeNext`
- Use Zod for tool input schemas
- Use `HermesKanbanClient` for hybrid REST+CLI transport
- Native Hermes routing fields (`assignee`, `workspace`, `skills`) use CLI flags / REST payload; `skills` maps to repeatable `--skill <name>` on `kanban create`; OpenSpec metadata is fenced in the body
- Only pass `--json` to CLI sub-commands that document it (`list`, `show`, `create`, `comment`, `update`); CLI-only commands (`heartbeat`, `claim`, `init`, `gc`, `link`, `unlink`, `watch`) do **not** support `--json`
- Write tests with `node:test` against compiled `server/dist/test/`

## Repository Structure

The repo is a two-package monorepo (no npm workspaces):
- **`server/`** — `@kzay/hermes-board-mcp` (MCP server, TypeScript)
- **`client/`** — `@kzay/hermes-board-skills` (client skills, static)
- **Root** — Private coordinator (`package.json` with `--prefix` scripts)

Each package has its own `package.json`, `node_modules`, and `package-lock.json`.

## Architecture Notes

This project implements:
- **Co-location**: The MCP server must run on the same host as the Hermes agent — it communicates via local CLI (`hermes kanban`) and loopback REST (`127.0.0.1:9119`).
- **MCP Server**: Exposes kanban + spec-import tools via HTTP on port 7332
- **HermesKanbanClient**: Per-call REST probe against dashboard plugin, with CLI fallback
- **Policy engine**: `server/policy.yaml` with default-deny per profile; hot-reload via SIGHUP
- **Auth**: Bearer tokens via `BOARD_MCP_TOKENS`; loopback bypass; SIGHUP reload
- **Project routing**: `resolveProject` and `resolveProjectByRepo` map project/repo slugs to board metadata (including `repo_url`, `repo_aliases`, `default_branch`)
- **Spec Provider Registry**: Pluggable `SpecProvider` interface in `server/src/spec-providers/`. Providers are selected by `spec_ref` prefix (e.g. `openspec:`, `speckit:`). Each provider implements `canResolve(specRef)` and `buildBody(specRef, opts)` to produce a task body with Git context and derived `spec_path`.
- **Committed-ref dispatch**: `hb_import_spec` requires `base_commit`, resolves the provider from `spec_ref`, and embeds portable Git checkout instructions in task bodies (defaults `workspace` to `scratch`). Accepts optional `spec_base_path` to override the provider's convention-based path derivation.
- **Configurable provider paths**: Each provider uses a convention-based default path (e.g. `openspec/changes/<name>/`, `speckit/specs/<id>/`). Clients can override per-provider via `hermes-board.json` (`openspec.root`, `speckit.root`), which feeds `spec_base_path` to `hb_import_spec`, which passes it as `specBasePath` in `BuildBodyOpts`.
- **Two-package model**: The server (`@kzay/hermes-board-mcp`, in `server/`) runs on the VPS with the Hermes agent. The client (`@kzay/hermes-board-skills`, in `client/`) is installed independently in the developer's IDE or CLI. The two packages can be installed separately and never co-exist on the same host.
- **Client skill release surface**: `client/` publishes canonical `hb-*` skills (`hb-deploy`, `hb-monitor`, `hb-plan`, `hb-worker`, `hb-release`) plus provider references, routing evals, and a tool coverage matrix.
- **Release checks**: `npm run release:check` (from root or `server/`) verifies stale release-facing tool names, client skill quality, docs drift, and package contents before publish.
- **Version alignment**: Server and client packages ship together (see `server/package.json` for current version).

## OpenSpec Integration

This project uses OpenSpec for spec-driven development.
- Changes live in `openspec/changes/`
- Run `openspec validate <change> --json` after implementation

## ECC Integration

This project uses Everything Claude Code (ECC) for enhanced AI assistance:
- **Skills**: Located in `.cursor/skills/` and `.claude/skills/`
- **Rules**: Located in `.cursor/rules/` (project-level) and `~/.claude/rules/` (global)
- **Agents**: See `.claude/agents/` and `~/.codex/agents/`
