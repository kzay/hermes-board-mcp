# Hermes Board Worker

Report worker progress, blockers, and liveness while completing Hermes Kanban tasks.

## When to Use

Use when the agent is acting as a worker on a Hermes task, needs to leave progress notes, report blockers, unblock resolved work, or send a heartbeat during long-running work.

## Steps

0. **Identify task context** - determine `board` and `task_id` from the user, environment, task body, or `hermes-board.json`.
1. **Inspect assigned work** - call `hb_show_task` before making status updates.
2. **Report progress** - call `hb_add_comment` for meaningful progress updates, decisions, and verification evidence.
3. **Send liveness** - call `hb_send_heartbeat` every few minutes during long operations or before lengthy test runs.
4. **Report blockers** - call `hb_block_task` with a clear reason when work cannot continue.
5. **Resume work** - call `hb_unblock_task` only when the blocker is resolved and the task can return to ready state.
6. **Complete work** - if the worker is responsible for completion and policy allows it, call `hb_complete_task` with a concise summary and result.

## Guardrails

- Do not claim running state manually; dispatch owns worker lifecycle.
- Do not mark work complete without verification evidence.
- Do not archive tasks from this skill; use `hb-release` for release/archive workflows.

## Tool Ownership

This skill owns worker workflows for `hb_show_task`, `hb_add_comment`, `hb_send_heartbeat`, `hb_block_task`, `hb_unblock_task`, and worker-side `hb_complete_task` when allowed by policy.
