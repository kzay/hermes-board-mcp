# Repository Setup for Public Contributions

This document describes how to configure GitHub settings for the public `hermes-board-mcp` repository.

## Branch Protection (Required)

Go to **Settings > Branches > Branch protection rules** and add a rule for `master` (and `main` if it exists):

### Required Settings

- [ ] **Require a pull request before merging**
  - [ ] **Require approvals**: minimum 1 approval from CODEOWNER for core changes
  - [ ] **Dismiss stale PR approvals when new commits are pushed**
  - [ ] **Require review from CODEOWNERS** when a PR affects files with a CODEOWNER

- [ ] **Require status checks to pass before merging**
  - Required checks:
    - `unit-release`
    - `pr-validation / validate`

- [ ] **Require conversation resolution before merging**

- [ ] **Require signed commits** (recommended for public repos)

- [ ] **Do not allow bypassing the above settings** (even for admins)

- [ ] **Restrict who can push to matching branches**
  - Only allow: `kzay` + designated maintainers

### Recommended Settings

- [ ] **Lock branch** (prevents force pushes and deletions)
- [ ] **Require linear history** (no merge commits)
- [ ] **Automatically delete head branches** after merge

## GitHub Features

### Discussions
Enable under **Settings > General > Discussions** for community Q&A.

### Security
- Enable **Dependabot alerts** and **Dependabot security updates** under **Settings > Security > Code security and analysis**
- Enable **Secret scanning** if available
- Ensure **Private vulnerability reporting** is enabled

### Actions
Under **Settings > Actions > General**:
- [ ] **Allow all actions and reusable workflows** (or restrict to verified creators)
- [ ] **Require approval for all outside collaborators** for workflow runs

## Labels

Ensure these labels exist for issue/PR triage:

| Label | Color | Use |
|-------|-------|-----|
| `bug` | #d73a4a | Something is broken |
| `enhancement` | #a2eeef | New feature or request |
| `security` | #d93f0b | Security-related |
| `documentation` | #0075ca | Docs only |
| `dependencies` | #0366d6 | Dependabot PRs |
| `breaking change` | #b60205 | Incompatible API change |
| `needs review` | #fbca04 | Awaiting reviewer |
| `wip` | #000000 | Work in progress |

## Release Process

1. Maintainer creates a release branch: `release/vX.Y.Z`
2. Run `npm run release:check`
3. Open PR with title `chore: release X.Y.Z`
4. After CI passes and review approved, merge to `master`
5. Run the **Publish** workflow manually via Actions tab

## Maintainer Checklist

- [ ] Branch protection rules applied to `master`
- [ ] CODEOWNERS file is active (Settings > Code review > CODEOWNERS)
- [ ] Issue templates are enabled
- [ ] PR template is active
- [ ] Dependabot is configured and running
- [ ] Security policy is linked in repo settings
- [ ] Repository topics and description are set
