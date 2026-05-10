import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OpenSpecProvider } from '../src/spec-providers/openspec.js';

describe('OpenSpecProvider', () => {
  const provider = new OpenSpecProvider();

  it('canResolve returns true for openspec: prefix', () => {
    assert.equal(provider.canResolve('openspec:add-dark-mode'), true);
  });

  it('canResolve returns false for other prefixes', () => {
    assert.equal(provider.canResolve('speckit:feature/42'), false);
    assert.equal(provider.canResolve('random-string'), false);
  });

  it('buildBody produces a valid hermes-board-spec fence', () => {
    const body = provider.buildBody('openspec:add-dark-mode', {
      repoUrl: 'git@github.com:org/repo.git',
      baseBranch: 'main',
      baseCommit: 'abc123def456',
    });

    assert.ok(body.includes('```hermes-board-spec'));
    assert.ok(body.includes('spec_provider: openspec'));
    assert.ok(body.includes('spec_ref: openspec:add-dark-mode'));
    assert.ok(body.includes('spec_path: openspec/changes/add-dark-mode/'));
    assert.ok(body.includes('repo_url: git@github.com:org/repo.git'));
    assert.ok(body.includes('base_branch: main'));
    assert.ok(body.includes('base_commit: abc123def456'));
  });

  it('derives spec_path from the change name', () => {
    const body = provider.buildBody('openspec:multi-spec-provider', {
      repoUrl: 'https://github.com/org/repo',
      baseBranch: 'develop',
      baseCommit: 'deadbeef',
    });

    assert.ok(body.includes('spec_path: openspec/changes/multi-spec-provider/'));
  });

  it('throws for empty change name', () => {
    assert.throws(
      () => provider.buildBody('openspec:', {
        repoUrl: 'https://github.com/org/repo',
        baseBranch: 'main',
        baseCommit: 'abc',
      }),
      /missing change name after prefix/,
    );
  });
});
