# SpecKit Provider Reference

Use this reference only after `hb-deploy` has resolved a `speckit:` spec reference or the user asks to dispatch a local SpecKit feature.

## Ref Resolution

- Supported ref format: `speckit:<identifier>`.
- The base directory defaults to `speckit/` but can be overridden via `hermes-board.json` (`speckit.root`). If configured, pass the root as `spec_base_path` to `hb_import_spec`.
- If the user gives only an identifier, find `<root>/specs/<identifier>/` and derive `spec_ref: "speckit:<identifier>"`.
- If `<root>/specs/<identifier>/` is missing, stop before task creation and report the missing path.

## Local Validation

- Verify the spec directory exists at `<root>/specs/<identifier>/` (where `<root>` is `speckit.root` from config or `speckit/` by default).
- If validation fails or the directory does not exist, report the issue and stop before `hb_import_spec`.

## Scoped Git Check

- Check only the SpecKit spec directory with `git status --short <root>/specs/<identifier>/`.
- If the spec directory has uncommitted files, show the scoped diff and offer an assisted commit that stages only `<root>/specs/<identifier>/`.
- Do not stage unrelated files.
- Do not push automatically.

## Gotchas

- Do not build a local task array from spec files; `hb_import_spec` creates one orchestration task and the server derives worker context from `spec_ref`.
- Do not send local IDE paths or VPS checkout paths as the worker source of truth.
- Do not dispatch if `base_commit` is not reachable by the remote worker.
- Do not promise support for `openspec:` or any other provider when handling a SpecKit request.
