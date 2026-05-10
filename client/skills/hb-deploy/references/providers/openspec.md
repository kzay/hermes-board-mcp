# OpenSpec Provider Reference

Use this reference only after `hb-deploy` has resolved an `openspec:` spec reference or the user asks to dispatch a local OpenSpec change.

## Ref Resolution

- Supported ref format: `openspec:<change-name>`.
- If the user gives only a change name, find `openspec/changes/<change-name>/` and derive `spec_ref: "openspec:<change-name>"`.
- If `openspec/changes/<change-name>/` is missing, stop before task creation and report the missing path.

## Local Validation

- Run OpenSpec validation for the change before checking Git reachability.
- If validation fails, report the validation output and stop before `hb_import_spec`.
- The `openspec` CLI must be available for `openspec:` refs.

## Scoped Git Check

- Check only the OpenSpec change directory with `git status --short openspec/changes/<change-name>/`.
- If the change directory has uncommitted files, show the scoped diff and offer an assisted commit that stages only `openspec/changes/<change-name>/`.
- Do not stage unrelated files.
- Do not push automatically.

## Gotchas

- Do not build a local task array from `tasks.md`; `hb_import_spec` creates one orchestration task and the server derives worker context from `spec_ref`.
- Do not send local IDE paths or VPS checkout paths as the worker source of truth.
- Do not dispatch if `base_commit` is not reachable by the remote worker.
- Do not promise support for `speckit:` or any other provider when handling an OpenSpec request.
