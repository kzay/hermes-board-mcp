# Hermes Board Deploy

Validate and dispatch a provider-backed spec to Hermes Kanban using `hb_import_spec`.

## When to Use

Use when the user says "deploy this spec", "push spec to kanban", "create board work from this change", "dispatch this change", or wants a local spec tracked by Hermes workers.

## Supported Providers

- `openspec:<change-name>` is supported for this release.
- `speckit:<feature-id>` is recognized by the server registry but is not release-ready yet. Do not promise successful dispatch for it.

If the user provides any other prefix, stop before task creation and report the supported release prefix.

## Steps

0. **Read client config** - read `hermes-board.json` from the repo root.
   - Prefer explicit user values over env vars, env vars over config, config over derived repo slug.
   - Use `project.slug` as the default `project`, `project.board` as the default `board`, and `repo.url` or a matching alias as the optional `repo` argument.
   - If the file is absent, derive a likely project slug from `git remote get-url origin` and ask before relying on it.
1. **Resolve the spec reference**.
   - For OpenSpec, find `openspec/changes/<name>/` and derive `spec_ref: "openspec:<name>"`.
   - If the user already supplied a provider-prefixed reference, validate the prefix before continuing.
2. **Validate locally**.
   - For `openspec:` refs, run local OpenSpec validation for the change.
   - If validation fails, report the errors and stop.
3. **Check Git status**.
   - For OpenSpec refs, run `git status --short openspec/changes/<name>/`.
   - If files are uncommitted, show the diff and offer an assisted commit that stages only that change directory.
   - Leave unrelated files unstaged.
   - Do not push automatically.
4. **Check worker reachability**.
   - Resolve `base_branch` from the current branch and `base_commit` from `HEAD`.
   - Verify `base_commit` is reachable from a remote branch, or ask the user for an explicit reachable ref.
   - If the commit is not reachable, stop before dispatch.
5. **Dispatch through MCP** - call `hb_import_spec` with:
   - `spec_ref`
   - `project` or `repo`
   - `base_branch`
   - `base_commit`
   - Optional: `board`, `assignee`, `workspace`, `skills`, `allowed_paths`

   Do not build a local task array for `hb_import_spec`. The server resolves the provider from `spec_ref`, creates one orchestration task, and embeds the portable checkout context for the worker.
6. **Report**.
   - Show the created task, idempotency key if returned, provider prefix, branch, commit, and board/project used.
   - Remind the user if a push is still needed for workers to fetch the commit.

## External Actions

Creating a local commit requires user approval after showing the relevant diff. Pushing, publishing, merging, changing credentials, or dispatching anything outside the requested MCP task creation requires explicit user approval.

## Prerequisites

- `hb_import_spec` MCP tool must be available.
- The repo must be a Git repository.
- `openspec` CLI must be available for `openspec:` refs.
- `hermes-board.json` is recommended for project and repo defaults.
