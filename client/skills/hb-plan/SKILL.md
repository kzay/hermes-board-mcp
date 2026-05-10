---
name: hb-plan
description: Load when the user wants to create, organize, assign, link, specify, triage, or dispatch normal Hermes Kanban tasks rather than importing a provider-backed spec.
---

# Hermes Board Plan

Create and organize Hermes Kanban work from a project repo.

## When to Use

Use when the user wants to create board tasks, triage work, assign owners, link dependencies, prepare tasks for workers, or dispatch ready work.

## Steps

0. **Read client config** - read `hermes-board.json` from the repo root and use `project.board` as the default board.
1. **Verify board** - call `hb_list_boards`; create a missing board with `hb_create_board` only when the user asks for it.
2. **Create tasks** - call `hb_create_task` with native Hermes fields:
   - `board`, `title`, optional `body`
   - Optional routing: `assignee`, `workspace`, `skills`, `priority`, `tenant`, `max_runtime`
   - Optional metadata: `spec_ref`, `acceptance_criteria`, `test_command`, `human_gate_required`
3. **Organize dependencies** - use `hb_link_tasks` and `hb_unlink_tasks`.
4. **Assign or adjust work** - use `hb_assign_task`, `hb_block_task`, `hb_unblock_task`, and `hb_add_comment`.
5. **Specify work** - use `hb_specify_task` when a task needs Hermes specification expansion.
6. **Dispatch** - call `hb_dispatch_tasks` only when the user wants ready work sent to workers.

## Guardrails

- Do not create large batches without confirming the intended board and scope.
- Do not use task creation as a substitute for `hb_import_spec` when the user is dispatching a provider-backed spec.
- Do not push, publish, merge, or change remote resources unless the user explicitly approves.
- Do not complete or archive release work from this skill.

## Tool Ownership

This skill owns normal planning workflows for `hb_create_board`, `hb_create_task`, `hb_assign_task`, `hb_block_task`, `hb_unblock_task`, `hb_add_comment`, `hb_link_tasks`, `hb_unlink_tasks`, `hb_specify_task`, and `hb_dispatch_tasks`.
