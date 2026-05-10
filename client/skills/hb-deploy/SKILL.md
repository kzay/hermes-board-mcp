---
name: hb-deploy
description: Load when the user wants to deploy, dispatch, push, or create board work from a provider-backed spec change through hb_import_spec, including OpenSpec refs such as openspec:<change-name>.
---

# Hermes Board Deploy

Validate and dispatch a provider-backed spec to Hermes Kanban using `hb_import_spec`. Keep this workflow provider-generic; load provider references for local validation rules.

## When to Use

Use when the user says "deploy this spec", "push spec to kanban", "create board work from this change", "dispatch this change", or wants a local spec tracked by Hermes workers.

## Supported Providers

- `openspec:<change-name>` is supported for this release. Read `references/providers/openspec.md` before deriving or validating an OpenSpec ref.
- `speckit:<feature-id>` is recognized by the server registry but is not release-ready yet. Do not promise successful dispatch for it.

If the user provides any other prefix, stop before task creation and report the supported release prefix.

## Steps

0. **Read client config** - read `hermes-board.json` from the repo root.
   - Prefer explicit user values over env vars, env vars over config, config over derived repo slug.
   - Use `project.slug` as the default `project`, `project.board` as the default `board`, and `repo.url` or a matching alias as the optional `repo` argument.
   - If the file is absent, derive a likely project slug from `git remote get-url origin` and ask before relying on it.
1. **Resolve the spec reference**.
   - If the user supplied a provider-prefixed reference, validate the prefix before continuing.
   - If the user named a provider without a full ref, load that provider reference and derive the `spec_ref`.
   - If the provider is supported but the needed local files are absent, stop before task creation and report what is missing.
2. **Validate provider-specific prerequisites**.
   - Load the provider reference for the resolved prefix.
   - Run only the local validation and scoped status checks described by that provider reference.
   - If validation fails or required files are uncommitted, report the issue and stop before `hb_import_spec`.
   - If offering an assisted commit, stage only the provider-owned spec path.
   - Leave unrelated files unstaged.
   - Do not push automatically.
3. **Check worker reachability**.
   - Resolve `base_branch` from the current branch and `base_commit` from `HEAD`.
   - Verify `base_commit` is reachable from a remote branch, or ask the user for an explicit reachable ref.
   - If the commit is not reachable, stop before dispatch.
4. **Dispatch through MCP** - call `hb_import_spec` with:
   - `spec_ref`
   - `project` or `repo`
   - `base_branch`
   - `base_commit`
   - Optional: `board`, `assignee`, `workspace`, `skills`, `allowed_paths`

   Do not build a local task array for `hb_import_spec`. The server resolves the provider from `spec_ref`, creates one orchestration task, and embeds the portable checkout context for the worker.
5. **Report**.
   - Show the created task, idempotency key if returned, provider prefix, branch, commit, and board/project used.
   - Remind the user if a push is still needed for workers to fetch the commit.

## External Actions

Creating a local commit requires user approval after showing the relevant diff. Pushing, publishing, merging, changing credentials, or dispatching anything outside the requested MCP task creation requires explicit user approval.

## Prerequisites

- `hb_import_spec` MCP tool must be available.
- The repo must be a Git repository.
- `hermes-board.json` is recommended for project and repo defaults.

## Provider Rule

Do not create or route to provider-specific top-level skills unless the provider has a genuinely different user intent or workflow. Provider-specific local rules belong in `references/providers/<provider>.md`.

## Gotchas

- Do not dispatch unsupported or experimental provider prefixes.
- Do not skip provider-local validation just because the server can resolve the prefix.
- Do not push, publish, merge, or mutate credentials while preparing dispatch.
