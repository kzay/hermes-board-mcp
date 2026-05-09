# OpenSpec Deploy

Deploy a local OpenSpec change to Hermes Kanban using a committed-ref workflow.

## When to Use

Use when the user says "deploy this spec", "push openspec to kanban", "create kanban tasks from spec", "dispatch this change", or wants to convert a local OpenSpec change into tracked Kanban tasks.

## Steps

0. **Read client config** — read `hermes-board.json` from the repo root.
   - If present: use `project.slug` as default `project`, `project.board` as default `board`, and `repo.url` as default `repo_url`.
   - If absent: derive the project slug from `git remote get-url origin` (basename minus `.git`) and ask the user to create `hermes-board.json` once before proceeding.
1. **Find the local change** — look for `openspec/changes/<name>/` in the current project root.
2. **Validate locally** — run local OpenSpec validation for the change. If validation fails, report errors and stop.
3. **Check Git status** — run `git status --short openspec/changes/<name>/` to detect uncommitted spec files.
4. **Assisted commit (if needed)** — if uncommitted files exist:
   - Show the diff to the user.
   - If the user approves, stage **only** files under `openspec/changes/<name>/` and create a commit with a message like `chore(spec): prepare <name> for dispatch`.
   - Reject any attempt to stage unrelated files.
   - Do **not** push automatically.
5. **Check reachable ref** — verify that the current commit (`HEAD`) is reachable from a remote branch using `git branch -r --contains HEAD` or `git merge-base --is-ancestor HEAD origin/<default_branch>`.
   - If the commit is not reachable, stop and inform the user. Ask them to push the branch or provide an explicit reachable ref before dispatching.
6. **Collect portable context** — gather the following:
   - `repo_url`: from `hermes-board.json` `repo.url` or `git remote get-url origin`
   - `base_branch`: current branch name (e.g. `main`)
   - `base_commit`: current `HEAD` hash
   - `spec_path`: relative path to the spec directory (e.g. `openspec/changes/<name>/`)
   - `spec_ref`: optional tag or ref for the spec
   - `test_command`: optional command from config or user input
7. **Dispatch** — call `kanban_create_from_openspec` with `project`, `change_name`, `base_commit`, `base_branch`, `repo_url`, `spec_path`, and any optional fields.
8. **Report** — show a summary of the dispatch, including the number of tasks created, their idempotency keys, and the commit/branch context sent to workers.

## Prerequisites

- `kanban_create_from_openspec` MCP tool must be available.
- The repo must be a Git repository.
- `hermes-board.json` is recommended for project defaults and repo metadata.
- Git must be available in the client environment.
