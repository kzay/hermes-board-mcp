# hermes-board-mcp — Agent Instructions

Two-package monorepo. Each package has its own `AGENTS.md`:

| Package | Instructions |
|---------|-------------|
| `@kzay/hermes-board-mcp` | [`server/AGENTS.md`](server/AGENTS.md) — MCP server (VPS, co-located with Hermes agent) |
| `@kzay/hermes-board-skills` | [`client/AGENTS.md`](client/AGENTS.md) — Client skills (developer IDE / CLI) |

## Package Manager

**npm** — no workspaces. Root delegates via `--prefix`:

```bash
cd server && npm install   # server deps
cd client && npm install   # client deps
```

## File-Scoped Commands

| Task | Command |
|------|---------|
| Build | `npm run build --prefix server` |
| Typecheck | `npm run typecheck --prefix server` |
| Test (all) | `npm test --prefix server` |
| Test (single) | `node --test server/dist/test/<file>.test.js` |
| Release check | `npm run release:check --prefix server` |

## Key Conventions

- TypeScript `strict`, `module: NodeNext`
- Tests: `node:test` against compiled `server/dist/test/`
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- See `CLAUDE.md` for architecture notes and dev workflow

## Safety Rules

1. Never install or upgrade packages outside the two managed packages without user confirmation
2. Never overwrite existing config files without showing the diff
3. Never delete boards, mass-archive tasks, or modify policy profiles unless explicitly requested
4. Never expose tokens in logs, output, or commits
