# Changelog

## 3.0.0 — Project-Aware Kanban Dispatch

### Add Project/Repo Routing & Committed-Ref Dispatch
- Added `kanban_heartbeat` tool for worker liveness signaling.
- **BREAKING**: Rewrote `kanban_create_from_openspec` to require committed Git context:
  - Now requires `base_commit` and supports `base_branch`, `repo_url`, `spec_ref`, `spec_path`, `test_command`, `allowed_paths`.
  - Defaults workspace to `scratch` if not supplied.
  - Derives idempotency keys from `project:change:commit:index`.
  - Includes portable Git checkout instructions in each task body.
  - Supports `project` or `repo` routing to resolve the target board.
  - Fails closed when routing is missing or ambiguous.
- Extended server-side project metadata (`factory-project.yaml`) with `board`, `repo_aliases`, `default_branch`.
- Added `resolveProjectByRepo` utility for repo URL normalization and alias matching.
- Extended `hermes-board.json` schema with `repo` section (`url`, `aliases`, `default_branch`).

### Client Skill Updates
- Rewrote `openspec-deploy` skill for committed-ref Git workflow:
  - Step 0 reads `hermes-board.json` including `repo.url`.
  - Validates the local OpenSpec change before dispatch.
  - Checks Git status for uncommitted spec files.
  - Offers assisted commit workflow that stages only `openspec/changes/<name>/`.
  - Verifies commit is reachable from a remote branch before dispatching.
  - Does not push without explicit user approval.
- Updated `openspec-monitor` skill to reference new v3 `kanban_create_from_openspec` fields.

### Documentation
- Updated README and agents docs for v3.

## 2.0.0 — hermes-board-mcp v2 Alignment

### Migrate to TypeScript (change 1)
- Ported all source (`src/`) and test (`test/`) files from JavaScript to TypeScript with `strict: true`
- Added `tsconfig.json` with `module: NodeNext`, `target: ES2022`, `outDir: dist`
- Updated `package.json` entry points to `dist/`, added `build`, `dev`, `typecheck`, `test` scripts
- Updated `Dockerfile` with multi-stage build for TypeScript compilation
- Fixed duplicate `name` key in `McpServer` constructor (`factory-mcp` removed)
- Fixed stale `[factory-mcp]` log prefix in `SIGTERM` handler
- Fixed incorrect `policy.yaml` path resolution (`../../` → `../` from `src/`)
- Added typed `HermesKanbanClient` with structured stdout/stderr handling

### Align with Hermes Kanban (change 2)
- **BREAKING**: Deleted `kanban_move_task` (workers do not claim tasks)
- **BREAKING**: Renamed tools to mirror Hermes CLI:
  - `kanban_boards` → `kanban_boards_list`
  - `kanban_tasks` → `kanban_list`
  - `kanban_create_task` → `kanban_create`
  - `kanban_create_from_spec` → `kanban_create_from_openspec`
  - `openspec_upload` → `openspec_push`
- Added 14 new kanban tools: `kanban_create_board`, `kanban_show`, `kanban_assign`, `kanban_complete`, `kanban_block`, `kanban_unblock`, `kanban_archive`, `kanban_comment`, `kanban_link`, `kanban_unlink`, `kanban_specify`, `kanban_dispatch`, `kanban_runs`, `kanban_stats`, `kanban_tail`
- Fixed status enum to Hermes canonical columns: `triage`, `todo`, `ready`, `running`, `blocked`, `done`, `archived`
- Added `HermesKanbanClient` hybrid REST+CLI transport with per-call REST probe, 30-second failure cache, and non-loopback security guard
- Rewrote `kanban_create` schema with native Hermes flags (`assignee`, `workspace`, `priority`, etc.) and fenced OpenSpec metadata block in body
- Rewrote `kanban_create_from_openspec` with:
  - Idempotency keys derived from `<project>:<change>:<index>`
  - Explicit `dependency_strategy` (`none`, `sequential`, `explicit`)
  - Canonical task list from `openspec instructions apply --json` with `tasks.md` fallback
- Rewrote `policy.yaml` with v2 tool names and updated profile access matrix
- Updated `README.md`, `AGENTS.md`, and `CLAUDE.md` for v2

### Add Client Config (change 3)
- Added `hermes-board.json` JSON Schema (`client/hermes-board.schema.json`) with `config_version: 1`
- Added `hermes-board-mcp init` subcommand that prints starter config to stdout
- Updated `openspec-deploy` and `openspec-monitor` skills to read `hermes-board.json` as Step 0
- Added `kanban-follow` workflow to `openspec-monitor` for end-to-end spec tracking
- Updated `postinstall.js` to scaffold `hermes-board.json` placeholder if absent (never overwrites)
- Updated `client/package.json` to version 2.0.0
