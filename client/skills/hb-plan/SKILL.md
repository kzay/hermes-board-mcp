---
name: hb-plan
description: Load when the user wants to create, organize, edit, assign, link, specify, triage, dispatch normal Hermes Kanban tasks, or manage board lifecycle (init, switch, rename, remove) rather than importing a provider-backed spec.
---

# Hermes Board Plan

Create and organize Hermes Kanban work from a project repo.

## When to Use

Use when the user wants to create board tasks, triage work, assign owners, link dependencies, prepare tasks for workers, or dispatch ready work.

## Steps

0. **Read client config** - read `hermes-board.json` from the repo root and use `project.board` as the default board.
1. **Initialize if needed** - call `hb_init` to ensure `kanban.db` exists (idempotent).
2. **Verify board** - call `hb_list_boards`; create a missing board with `hb_create_board` only when the user asks for it.
   - **Manage boards** - use `hb_boards_switch` to change the active board, `hb_boards_rename` to update a display name, `hb_boards_rm` to archive or delete a non-default board.
3. **Create tasks** - call `hb_create_task` with native Hermes fields:
   - `board`, `title`, optional `body`
   - Optional routing: `assignee`, `workspace`, `skills`, `priority`, `tenant`, `max_runtime`
   - Optional metadata: `spec_ref`, `acceptance_criteria`, `test_command`, `human_gate_required`
4. **Edit existing tasks** - call `hb_edit_task` to update title, body, priority, or result on existing tasks.
5. **Organize dependencies** - use `hb_link_tasks` and `hb_unlink_tasks`.
6. **Assign or adjust work** - use `hb_assign_task`, `hb_block_task`, `hb_unblock_task`, and `hb_add_comment`.
7. **Specify work** - use `hb_specify_task` when a task needs Hermes specification expansion.
8. **Dispatch** - call `hb_dispatch_tasks` only when the user wants ready work sent to workers.

## Guardrails

- Do not create large batches without confirming the intended board and scope.
- Do not use task creation as a substitute for `hb_import_spec` when the user is dispatching a provider-backed spec.
- Do not push, publish, merge, or change remote resources unless the user explicitly approves.
- Do not complete or archive release work from this skill.

## Tool Ownership

This skill owns normal planning workflows for `hb_init`, `hb_create_board`, `hb_boards_switch`, `hb_boards_rename`, `hb_create_task`, `hb_edit_task`, `hb_assign_task`, `hb_block_task`, `hb_unblock_task`, `hb_add_comment`, `hb_link_tasks`, `hb_unlink_tasks`, `hb_specify_task`, and `hb_dispatch_tasks`.
