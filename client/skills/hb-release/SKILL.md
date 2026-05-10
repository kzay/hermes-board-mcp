# Hermes Board Release

Verify, complete, archive, and summarize release work tracked in Hermes Kanban.

## When to Use

Use when the user asks to prepare a release, check whether release tasks are done, complete finished work, archive completed tasks, or run package release checks.

## Steps

0. **Read client config** - read `hermes-board.json` and use `project.board` as the default board.
1. **Check release state** - call `hb_list_tasks`, `hb_show_task`, `hb_get_runs`, and `hb_get_stats` to summarize the board.
2. **Run local verification** - run local build, tests, package dry runs, and release checks requested by the repo.
3. **Complete tasks** - call `hb_complete_task` only for tasks that have clear verification evidence.
4. **Archive tasks** - call `hb_archive_task` only after completion and when the user wants completed work archived.
5. **Summarize release readiness** - report blockers, remaining tasks, completed tasks, and exact verification commands run.

## External Actions

This skill must not publish packages, push Git refs, create releases, merge pull requests, or modify credentials unless the user explicitly approves that exact external action.

## Tool Ownership

This skill owns release workflows for `hb_list_tasks`, `hb_show_task`, `hb_get_runs`, `hb_get_stats`, `hb_complete_task`, and `hb_archive_task`.
