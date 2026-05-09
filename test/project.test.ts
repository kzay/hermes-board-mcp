import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('project', () => {
  let resolveProject: typeof import('../src/project.js').resolveProject;
  let resolveOpenspecRoot: typeof import('../src/project.js').resolveOpenspecRoot;

  beforeEach(async () => {
    process.env.HERMES_PROJECTS_BASE = '/tmp/nonexistent-test-projects';
    const mod = await import('../src/project.js?t=' + Date.now());
    resolveProject = mod.resolveProject;
    resolveOpenspecRoot = mod.resolveOpenspecRoot;
  });

  it('returns null for empty slug', () => {
    assert.equal(resolveProject(''), null);
    assert.equal(resolveProject(null as unknown as string), null);
    assert.equal(resolveProject(undefined as unknown as string), null);
  });

  it('returns null for nonexistent project', () => {
    assert.equal(resolveProject('no-such-board'), null);
  });

  it('resolveOpenspecRoot falls back to default for missing project', () => {
    const result = resolveOpenspecRoot('no-such-board');
    assert.ok(result.includes('.hermes'));
  });
});
