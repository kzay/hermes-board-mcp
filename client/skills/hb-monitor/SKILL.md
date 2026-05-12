---
name: hb-monitor
description: Load when the user wants board status, task status, worker runs, worker logs, assignee overview, board events, kanban overview, spec status, or to follow provider-backed Hermes work until completion or failure.
---

# Hermes Board Monitor

Inspect Hermes Kanban boards and follow provider-backed spec work end to end.

## When to Use

Use when the user says "show board status", "check factory", "what tasks are pending", "kanban overview", "spec status", "follow this spec", or wants a summary of Hermes activity.

## Steps

0. **Read client config** - read `hermes-board.json` from the repo root.
   - Use `project.slug` and `project.board` as defaults when present.
   - If absent, derive a likely project slug from `git remote get-url origin` and ask before relying on it.
1. **Route by intent** - if the user provided a specific spec or task name as argument, jump directly to the **Spec-Specific Lookup** section. Skip the health narration and board overview entirely.
2. **Verify connection** (general overview only) - use the HTTP health endpoint or `hb_health` when the profile is allowed to call it.
3. **List boards** - call `hb_list_boards`.
4. **Show summary** - display boards with task counts by status.
5. **Drill down** - if the user asks about a board, call `hb_list_tasks` with `board` and optional `status`.
6. **Inspect active work** - call `hb_show_task`, `hb_get_runs`, or `hb_tail_events` for specific tasks as needed.
7. **Inspect worker details** - call `hb_task_log` to read a worker's log file; call `hb_task_context` to see the full context a worker receives (title, body, parent results, comments).
8. **Board-wide observability** - call `hb_watch_events` for a snapshot of recent board events (filterable by assignee, tenant, kinds); call `hb_list_assignees` for profiles with per-assignee task counts; call `hb_boards_show` for current board metadata.
9. **Notification visibility** - call `hb_notify_list` to see active notification subscriptions for a task or the whole board.
10. **Check local specs** - for OpenSpec status, run `openspec list --json` locally. The MCP server does not read local spec files.

## Spec-Specific Lookup

Purpose: Fast-path when the user provides a spec or task name (e.g. `/hb-monitor create-testfile-log-loop`). This path must be **lean and immediate** — no board overview, no verbose connection report, no operational noise before the answer.

1. **Single call** - call `hb_list_tasks` on `project.board`. Search results for a task matching the name (by `spec_ref` prefix `openspec:<name>` or title match).
2. **If found** - immediately show task status, then inspect runs/events per the Follow Workflow below. No board summary table.
3. **If not found on the default board** - one more call across other boards if any exist.
4. **If not found anywhere** - report ONE line:
   - `"<name> is not on any board. Deploy with: /hb-deploy <name>"`
   - Stop. Do NOT show a board summary table, connection details, or task counts. Do NOT narrate intermediate steps ("Let me pull tasks...", "MCP is healthy..."). The user wants an answer, not a journey.
5. **Never ask to switch** - state the next action directly, never phrase it as a question ("Want me to...?").

## Follow Workflow

Purpose: Track a deployed provider-backed spec until completion or failure.

1. **Identify spec work**.
   - Use the provider-prefixed `spec_ref` when known, such as `openspec:add-dark-mode`.
   - Call `hb_list_tasks` for the board and identify matching metadata or idempotency prefixes.
2. **Check statuses**.
   - `running`: call `hb_get_runs`, then optionally `hb_tail_events`.
   - `blocked`: call `hb_show_task` and surface the blocker reason.
   - `triage`, `todo`, `ready`: report pending state.
   - `done`, `archived`: mark complete.
3. **Summarize**.
   - Report total tasks, done count, blocked count, running count, and provider-prefixed `spec_ref`.
   - Surface blockers and latest worker summaries clearly.
4. **Loop or stop**.
   - If tasks remain active and the user wants continuous tracking, wait briefly and repeat.
   - Otherwise report current state and stop.

## Prerequisites

- `hb_list_boards`, `hb_list_tasks`, `hb_show_task`, `hb_get_runs`, `hb_tail_events`, `hb_watch_events`, `hb_list_assignees`, `hb_task_log`, `hb_task_context`, `hb_boards_show`, `hb_notify_list` MCP tools must be available.
- `openspec` CLI is only needed for local OpenSpec listing.

## Gotchas

- Do not create, dispatch, complete, or archive tasks from this skill.
- Do not infer completion from a quiet board; inspect task status and runs.
- Do not require local OpenSpec files to monitor already-dispatched provider work.
- When a spec name is provided and not found, do NOT narrate the search process ("MCP is healthy", "Let me pull tasks...", board tables). Give the answer immediately.
- Never ask "Want me to switch to /hb-deploy?" — state the action directly: "Deploy with: /hb-deploy <name>".
