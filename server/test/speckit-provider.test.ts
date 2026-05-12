import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SpeckitProvider } from '../src/spec-providers/speckit.js';

describe('SpeckitProvider', () => {
  const provider = new SpeckitProvider();

  it('canResolve returns true for speckit: prefix', () => {
    assert.equal(provider.canResolve('speckit:feature/42'), true);
    assert.equal(provider.canResolve('speckit:add-user-auth'), true);
  });

  it('canResolve returns false for other prefixes', () => {
    assert.equal(provider.canResolve('openspec:add-dark-mode'), false);
    assert.equal(provider.canResolve('random-string'), false);
    assert.equal(provider.canResolve(''), false);
  });

  it('buildBody produces a valid hermes-board-spec fence', () => {
    const body = provider.buildBody('speckit:add-user-auth', {
      repoUrl: 'git@github.com:org/repo.git',
      baseBranch: 'main',
      baseCommit: 'abc123def456',
    });

    assert.ok(body.includes('```hermes-board-spec'));
    assert.ok(body.includes('spec_provider: speckit'));
    assert.ok(body.includes('spec_ref: speckit:add-user-auth'));
    assert.ok(body.includes('spec_path: speckit/specs/add-user-auth/'));
    assert.ok(body.includes('repo_url: git@github.com:org/repo.git'));
    assert.ok(body.includes('base_branch: main'));
    assert.ok(body.includes('base_commit: abc123def456'));
  });

  it('derives spec_path for kebab-case identifiers', () => {
    const body = provider.buildBody('speckit:add-user-auth', {
      repoUrl: 'https://github.com/org/repo',
      baseBranch: 'develop',
      baseCommit: 'deadbeef',
    });
    assert.ok(body.includes('spec_path: speckit/specs/add-user-auth/'));
  });

  it('derives spec_path for slashed identifiers', () => {
    const body = provider.buildBody('speckit:feature/42', {
      repoUrl: 'https://github.com/org/repo',
      baseBranch: 'main',
      baseCommit: 'deadbeef',
    });
    assert.ok(body.includes('spec_path: speckit/specs/feature/42/'));
  });

  it('derives spec_path for dotted identifiers', () => {
    const body = provider.buildBody('speckit:v2.1.0', {
      repoUrl: 'https://github.com/org/repo',
      baseBranch: 'main',
      baseCommit: 'deadbeef',
    });
    assert.ok(body.includes('spec_path: speckit/specs/v2.1.0/'));
  });

  it('throws for empty identifier', () => {
    assert.throws(
      () => provider.buildBody('speckit:', {
        repoUrl: 'https://github.com/org/repo',
        baseBranch: 'main',
        baseCommit: 'abc',
      }),
      /missing identifier after prefix/,
    );
  });

  it('uses opts.specBasePath when provided', () => {
    const body = provider.buildBody('speckit:my-feature', {
      repoUrl: 'https://github.com/org/repo',
      baseBranch: 'main',
      baseCommit: 'deadbeef',
      specBasePath: 'custom-speckit/',
    });
    assert.ok(body.includes('spec_path: custom-speckit/specs/my-feature/'));
  });

  it('normalizes opts.specBasePath without trailing slash', () => {
    const body = provider.buildBody('speckit:my-feature', {
      repoUrl: 'https://github.com/org/repo',
      baseBranch: 'main',
      baseCommit: 'deadbeef',
      specBasePath: 'custom-speckit',
    });
    assert.ok(body.includes('spec_path: custom-speckit/specs/my-feature/'));
  });

  it('falls back to convention when specBasePath is undefined', () => {
    const body = provider.buildBody('speckit:my-feature', {
      repoUrl: 'https://github.com/org/repo',
      baseBranch: 'main',
      baseCommit: 'deadbeef',
    });
    assert.ok(body.includes('spec_path: speckit/specs/my-feature/'));
  });
});
