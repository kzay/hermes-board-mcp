# Changelog

## 3.5.0 - 2026-05-12

### Added
- `speckit:<identifier>` provider support for `hb_import_spec`.
- Configurable provider base paths via `spec_base_path` / `BuildBodyOpts.specBasePath`.

### Changed
- `openspec:` and `speckit:` dispatch now support project-configured provider roots.

## 3.3.4 - 2026-05-11

### Fixed
- `hb_add_comment`: Removed unsupported `--json` flag from CLI fallback args for `hermes kanban comment`.

## 3.3.2 - 2026-05-10

### Fixed
- `hb_import_spec`: When `board` is provided directly, `args.repo` is now used as a fallback repo URL if no `factory-project.yaml` exists on disk.
- Server version string now reads from `package.json` instead of a hardcoded value.
- `hb_show_task` / `hb_complete_task`: Defensive numeric parsing for `task_id` to handle string-vs-number coercion.
- `base_commit` input validated with a Zod refinement to reject non-hex values at schema level.
- `tryRestThenCli`: Non-auth client errors (4xx excluding 401/403) are re-thrown directly; **401/403 (auth errors) still fall back to CLI** so environments where the dashboard requires auth work correctly.
- `RestError.isAuthError` (401/403) introduced to distinguish auth failures from request errors — prevents e2e failures when dashboard REST requires authentication.
- `HERMES_KANBAN_API_TOKEN` env var: when set, the client sends `Authorization: Bearer <token>` on every dashboard REST call, enabling use of an authenticated dashboard instead of falling back to CLI.
- SIGHUP handlers in `auth.ts` and `policy.ts` are now guarded with `process.platform !== 'win32'` to prevent crashes on Windows.
- CLI argument parser rejects unknown flags with a clear error message.

### Added
- `RestError` class in `hermes-client.ts` for typed HTTP error handling with `isClientError` / `isServerError` / `isAuthError` classification.
- `dispose()` method on `HermesKanbanClient` for clean resource teardown; wired to server close event.
- `globMatch()` helper in `policy.ts` supporting `*` and `?` wildcards in policy tool lists.
- `resolveProjectByRepo` results cached for 60 seconds to avoid repeated filesystem scans.
- PolicyViolationError now returns HTTP 403 (was generic 500).
- New test suites: `RestError`, `HermesKanbanClient.dispose()`, `globMatch`, tool input schema validation, REST fallback classification.

### Documentation
- `AGENTS.md`: Documented project-by-repo cache TTL, Windows SIGHUP limitation, and policy glob patterns.

## 3.3.1 - Public production release hardening

### Fixed
- Server-side compatibility shim for Cursor IDE MCP client. Injects `Accept: application/json, text/event-stream` header on incoming `/mcp` requests when the client doesn't advertise SSE support, preventing 406 errors during initialization handshake.
- Client package configuration: Fixed `hermes-board-mcp.example.json` to use `${env:HERMES_BOARD_MCP_TOKEN}` (was `${BOARD_MCP_TOKEN}` without `env:` prefix, causing silent empty tokens). Updated README and AGENTS docs to clarify that Cursor does not support `.env` / `envFile` for HTTP/SSE MCP servers — users must set `HERMES_BOARD_MCP_TOKEN` as a system environment variable and restart Cursor.

### Client Skills
- Added frontmatter routing metadata to the canonical `hb-*` skills.
- Kept top-level skills workflow-oriented and moved OpenSpec-specific deploy details into `hb-deploy/references/providers/openspec.md`.
- Added routing eval fixtures to guard skill selection across deploy, monitor, plan, worker, and release workflows.
- Updated client postinstall to copy whole skill directories, including nested provider references, without overwriting existing files.

### Release Readiness
- Extended release checks to validate client skill source quality, routing eval references, stale skill directories, and required package files.
- Aligned server and client packages at version `3.3.1`.
- Included public release assets and deployment files in the npm package surface.

## 3.2.0 - Release-ready client skills and provider import

### MCP Tool Surface
- **BREAKING**: The release-facing MCP surface uses canonical `hb_*` tool names.
- Added `hb_health` to policy-backed setup verification.
- `hb_import_spec` is the canonical provider-backed spec import tool. It accepts `spec_ref`, `base_commit`, and optional routing fields; OpenSpec dispatch uses `spec_ref: "openspec:<change-name>"`.
- Internal Hermes CLI calls remain unchanged.

### Client Skills
- **BREAKING**: The published client package installs only canonical `hb-*` skills:
  - `hb-deploy`
  - `hb-monitor`
  - `hb-plan`
  - `hb-worker`
  - `hb-release`
- Removed stale duplicate OpenSpec-named skill directories from package contents.
- Added a tool coverage matrix and package dry-run release verification.

### Release Alignment
- Server and client packages are aligned at version `3.2.0`.
- Starter `hermes-board.json` examples default remote committed-ref dispatch to `scratch`.
- Updated release-facing docs, policy, client instructions, CLI help, and main OpenSpec specs.

## 3.1.0 - Server-side OpenSpec cleanup and provider groundwork

- Removed server-side OpenSpec file handling from the MCP server.
- Shifted validation and local spec discovery to client skills.
- Introduced project/repo routing and committed Git context for remote worker dispatch.
- Added the provider registry shape that became the release `hb_import_spec` workflow.

## 3.0.0 - Project-aware Kanban dispatch

- Added project metadata routing through Hermes project configuration.
- Added worker heartbeat support.
- Defaulted committed-ref coding dispatch to the `scratch` workspace.
- Added `repo` metadata to `hermes-board.json` examples and schema.
- Updated client deploy workflows to validate local specs, ensure commits are reachable, and avoid pushing without explicit approval.

## 2.0.0 - TypeScript and Hermes Kanban alignment

- Ported source and tests to TypeScript with strict `NodeNext` compilation.
- Added hybrid dashboard REST plus Hermes CLI fallback.
- Aligned task schemas with native Hermes ownership fields such as assignee, workspace, priority, runtime, and skills.
- Added policy-based profile access control and unit tests.
