# hermes-board-mcp

## Overview

This is an MCP (Model Context Protocol) server for the Hermes board system.

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
- Native Hermes routing fields (`assignee`, `workspace`, `skills`) use CLI flags / REST payload; OpenSpec metadata is fenced in the body
- Write tests with `node:test` against compiled `dist/test/`

## Architecture Notes

This project implements:
- **MCP Server**: Exposes kanban + OpenSpec tools via HTTP on port 7332
- **HermesKanbanClient**: Per-call REST probe against dashboard plugin, with CLI fallback
- **Policy engine**: `policy.yaml` with default-deny per profile; hot-reload via SIGHUP
- **Auth**: Bearer tokens via `BOARD_MCP_TOKENS`; loopback bypass; SIGHUP reload
- **Project routing**: `resolveProject` and `resolveProjectByRepo` map project/repo slugs to board metadata (including `repo_url`, `repo_aliases`, `default_branch`)
- **Committed-ref dispatch**: `kanban_create_from_openspec` requires `base_commit`, embeds portable Git checkout instructions in task bodies, and defaults `workspace` to `scratch`

## OpenSpec Integration

This project uses OpenSpec for spec-driven development.
- Changes live in `openspec/changes/`
- Run `openspec validate <change> --json` after implementation

## ECC Integration

This project uses Everything Claude Code (ECC) for enhanced AI assistance:
- **Skills**: Located in `.cursor/skills/` and `.claude/skills/`
- **Rules**: Located in `.cursor/rules/` (project-level) and `~/.claude/rules/` (global)
- **Agents**: See `.claude/agents/` and `~/.codex/agents/`
