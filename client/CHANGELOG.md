# Changelog

## 3.5.0 - 2026-05-12

- Added `speckit:` provider guidance for `hb-deploy`.
- Added `speckit.root` and `openspec.root` provider path handling in `hermes-board.json`.

## 3.3.4 - 2026-05-11

- Version bump to align with server fix (no client changes).

## 3.3.1 - Skill packaging hardening

- Added skill frontmatter routing metadata for all canonical `hb-*` skills.
- Added provider references under `hb-deploy/references/providers/`.
- Added routing eval fixtures for canonical skill selection.
- Updated postinstall to copy whole skill directories without overwriting existing files.

## 3.2.0 - Canonical client skills

- Published canonical `hb-*` skills for Cursor IDE workflows.
- Removed stale OpenSpec-named skill entry points from the package surface.
