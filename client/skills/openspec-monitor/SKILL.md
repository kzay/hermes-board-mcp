# OpenSpec Monitor

Check the status of kanban boards and OpenSpec changes on the Hermes Factory VPS. Track deployed specs end-to-end.

## When to Use

Use when the user says "show board status", "check factory", "what tasks are pending", "kanban overview", "spec status", "follow this spec", or wants a summary of factory activity.

## Steps

0. **Read client config** — read `hermes-board.json` from the repo root.
   - If present: use `project.slug` as default `project` / `board`.
   - If absent: derive the project slug from `git remote get-url origin` (basename minus `.git`) and ask the user to create `hermes-board.json` once before proceeding.
1. **List boards** — call `kanban_boards_list` to get all boards with task counts.
2. **Show summary** — display a table of boards with their task counts per status column.
3. **Drill down (optional)** — if the user asks about a specific board, call `kanban_list` with the board slug and optional status filter.
4. **Check specs (optional)** — if the user asks about OpenSpec changes, call `openspec_list` with the project slug and display change names with their status.
5. **Follow (optional)** — if the user wants to track a deployed spec until completion, run the `kanban-follow` workflow below.

## kanban-follow Workflow

Purpose: Track an OpenSpec change end-to-end until all tasks are done or archived.

1. **Identify spec tasks** — call `kanban_list` with `board` and optionally filter by `spec_ref` metadata or an idempotency prefix derived from the change name.
2. **Check statuses** — for each task:
   - `running` → call `kanban_runs` to surface latest worker output and summary.
   - `blocked` → call `kanban_show` to surface blocker reason and metadata.
   - `triage`, `todo`, `ready` → report pending state.
   - `done`, `archived` → mark complete.
3. **Summarize** — report: total tasks, done count, blocked count, running count. If blockers exist, surface them clearly. If all tasks are done/archived, report completion.
4. **Loop or stop** — if tasks remain active and the user wants continuous tracking, wait briefly (e.g. 30s) and repeat. Otherwise stop and report current state.

## Prerequisites

- `kanban_boards_list`, `kanban_list`, `kanban_show`, `kanban_runs`, `openspec_list` MCP tools must be available
- `hermes-board.json` is recommended for project defaults
