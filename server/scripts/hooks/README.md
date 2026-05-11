# Git Hooks — Preventing Cursor IDE Attribution

This repository uses a `commit-msg` hook to prevent the Cursor IDE from silently appending attribution to commits.

## The Problem

By default, the Cursor IDE injects the following into commit messages:

```
Co-authored-by: Cursor <cursoragent@cursor.com>
```

This causes:
- Git history showing `Cursor` as a co-author
- GitHub commits appearing as "co-authored by Cursor" in the UI
- Misattribution of work when you are the sole author

## Solutions

### Option 1: Disable in Cursor IDE (Recommended)

Go to **Cursor Settings** (Ctrl+,) → search for:
- `git.addCursorAttribution` → set to `false`

Or edit `~/.cursor/settings.json`:

```json
{
  "git.addCursorAttribution": false
}
```

### Option 2: Use the commit-msg Hook

Activate the project hook:

```bash
# On Unix/macOS
cp scripts/hooks/commit-msg .git/hooks/commit-msg
chmod +x .git/hooks/commit-msg

# On Windows (PowerShell)
copy scripts\hooks\commit-msg .git\hooks\commit-msg
```

Or set a global hooks path:

```bash
git config --global core.hooksPath /path/to/your/hooks
```

When the hook is active, any commit containing `Co-authored-by: Cursor` will be rejected with:

```
ERROR: Commit message contains Cursor IDE attribution.
       Remove the 'Co-authored-by: Cursor' line before committing.
       If you authored this commit yourself, the attribution is incorrect.
```

## Attribution Policy

All commits to this repository should reflect the actual author. If you are the sole author, do not include any `Co-authored-by` trailer.

If you genuinely collaborated with someone, add `Co-authored-by: Name <email>` manually, and ensure the email matches their actual Git identity.
