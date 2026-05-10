# Changelog

## 3.3.1 - Public production release hardening

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
