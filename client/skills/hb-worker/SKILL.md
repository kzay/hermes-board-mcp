---
name: hb-worker
description: Load when the agent is acting on an assigned Hermes task and must inspect work, leave progress comments, report blockers, send heartbeats, unblock, or complete verified worker work.
---

# Hermes Board Worker

Report worker progress, blockers, and liveness while completing Hermes Kanban tasks.

## When to Use

Use when the agent is acting as a worker on a Hermes task, needs to leave progress notes, report blockers, unblock resolved work, or send a heartbeat during long-running work.

## Steps

0. **Identify task context** - determine `board` and `task_id` from the user, environment, task body, or `hermes-board.json`.
1. **Claim work** - call `hb_claim_task` to atomically claim a ready task and get the resolved workspace path. Optional `ttl` sets a time limit.
2. **Inspect assigned work** - call `hb_show_task` before making status updates; call `hb_task_context` to read the full worker context (title, body, parent results, comments).
3. **Report progress** - call `hb_add_comment` for meaningful progress updates, decisions, and verification evidence.
4. **Send liveness** - call `hb_send_heartbeat` every few minutes during long operations or before lengthy test runs.
5. **Report blockers** - call `hb_block_task` with a clear reason when work cannot continue.
6. **Resume work** - call `hb_unblock_task` only when the blocker is resolved and the task can return to ready state.
7. **Complete work** - if the worker is responsible for completion and policy allows it, call `hb_complete_task` with a concise summary, result, and optional `metadata` for structured handoff data.

## Guardrails

- Do not claim running state manually; dispatch owns worker lifecycle.
- Do not mark work complete without verification evidence.
- Do not archive tasks from this skill; use `hb-release` for release/archive workflows.
- Do not use worker comments as a substitute for blocking when work cannot continue.

## Tool Ownership

This skill owns worker workflows for `hb_claim_task`, `hb_show_task`, `hb_task_context`, `hb_add_comment`, `hb_send_heartbeat`, `hb_block_task`, `hb_unblock_task`, and worker-side `hb_complete_task` (with `metadata`) when allowed by policy.
