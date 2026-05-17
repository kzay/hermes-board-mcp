---
name: hb-deploy
description: Load when the user wants to deploy, dispatch, push, or create board work from a provider-backed spec change through hb_import_spec, including openspec:<change-name> and speckit:<identifier> refs.
---

# Hermes Board Deploy

Validate and dispatch a provider-backed spec to Hermes Kanban using `hb_import_spec`. Keep this workflow provider-generic; load provider references for local validation rules.

## When to Use

Use when the user says "deploy this spec", "push spec to kanban", "create board work from this change", "dispatch this change", or wants a local spec tracked by Hermes workers.

## Execution Principle

When the user invokes `/hb-deploy <name>`, the intent is **already declared**. Do not ask "do you want to deploy?" or "shall I proceed?" — execute. Only stop if a real blocker exists (missing files, uncommitted changes, unreachable commit, unsupported prefix). If all prerequisites pass, dispatch immediately and report the result. No narration of intermediate steps, no confirmation prompts when there is nothing blocking.

## Supported Providers

- `openspec:<change-name>` — read `references/providers/openspec.md` before deriving or validating an OpenSpec ref.
- `speckit:<identifier>` — read `references/providers/speckit.md` before deriving or validating a SpecKit feature.

Both providers support configurable base paths via `hermes-board.json` (`openspec.root` / `speckit.root`). When configured, pass the provider root as `spec_base_path` to `hb_import_spec`.

If the user provides any other prefix, stop before task creation and report the supported prefixes.

## Steps

0. **Read client config** - read `hermes-board.json` from the repo root.
   - Prefer explicit user values over env vars, env vars over config, config over derived repo slug.
   - Use `project.slug` as the default `project`, `project.board` as the default `board`, and `repo.url` or a matching alias as the optional `repo` argument.
   - Read the provider-specific root if configured (e.g. `openspec.root`, `speckit.root`) to pass as `spec_base_path`.
   - Use `defaults.assignee` as the default `assignee` for `hb_import_spec` when the user does not provide one explicitly.
   - Use `defaults.workspace` as the default `workspace` for `hb_import_spec` when the user does not provide one explicitly.
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
   - Verify `base_commit` is reachable from a remote branch.
   - If not reachable, report the blocker concisely: `"HEAD is not pushed. Run git push, then re-run /hb-deploy <name>."` — stop.
   - Do not ask the user for an alternative ref unless they explicitly said to use a different commit.
4. **Select workspace mode**.
   - If `defaults.workspace` was read from `hermes-board.json` in Step 0 and the user did not override it, use that value.
   - If neither the user nor the config specifies a workspace, default to `"scratch"`. Note to the user that `scratch` may not provision a repo checkout for release-stage tasks.
5. **Dispatch through MCP** - call `hb_import_spec` with:
   - `spec_ref`
   - `project` or `repo`
   - `base_branch`
   - `base_commit`
   - Optional: `board`, `assignee`, `workspace`, `skills`, `allowed_paths`, `spec_base_path`

   Do not build a local task array for `hb_import_spec`. The server resolves the provider from `spec_ref`, creates one orchestration task, and embeds the portable checkout context for the worker.
6. **Report**.
   - Show the created task, idempotency key if returned, provider prefix, branch, commit, and board/project used.
   - Remind the user if a push is still needed for workers to fetch the commit.

## External Actions

The dispatch itself (`hb_import_spec`) does NOT require confirmation — that IS the action the user requested.

Only these side-effects require approval:
- Creating a local commit (show the scoped diff first)
- Pushing to remote
- Publishing, merging, or changing credentials

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
- When `hermes-board.json` has a provider root configured, always pass it as `spec_base_path` — do not silently rely on server convention defaults.
