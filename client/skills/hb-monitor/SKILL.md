---
name: hb-monitor
description: Load when the user wants board status, task status, worker runs, kanban overview, spec status, or to follow provider-backed Hermes work until completion or failure.
---

# Hermes Board Monitor

Inspect Hermes Kanban boards and follow provider-backed spec work end to end.

## When to Use

Use when the user says "show board status", "check factory", "what tasks are pending", "kanban overview", "spec status", "follow this spec", or wants a summary of Hermes activity.

## Steps

0. **Read client config** - read `hermes-board.json` from the repo root.
   - Use `project.slug` and `project.board` as defaults when present.
   - If absent, derive a likely project slug from `git remote get-url origin` and ask before relying on it.
1. **Verify connection** - use the HTTP health endpoint or `hb_health` when the profile is allowed to call it.
2. **List boards** - call `hb_list_boards`.
3. **Show summary** - display boards with task counts by status.
4. **Drill down** - if the user asks about a board, call `hb_list_tasks` with `board` and optional `status`.
5. **Inspect active work** - call `hb_show_task`, `hb_get_runs`, or `hb_tail_events` for specific tasks as needed.
6. **Check local specs** - for OpenSpec status, run `openspec list --json` locally. The MCP server does not read local spec files.

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

- `hb_list_boards`, `hb_list_tasks`, `hb_show_task`, `hb_get_runs`, and `hb_tail_events` MCP tools must be available.
- `openspec` CLI is only needed for local OpenSpec listing.

## Gotchas

- Do not create, dispatch, complete, or archive tasks from this skill.
- Do not infer completion from a quiet board; inspect task status and runs.
- Do not require local OpenSpec files to monitor already-dispatched provider work.
