import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { clearProviders, registerProvider } from '../src/spec-providers/registry.js';
import { OpenSpecProvider } from '../src/spec-providers/openspec.js';

describe('hb_import_spec handler', () => {
  let toolDefs: typeof import('../src/tools.js').toolDefs;
  let handler: (args: Record<string, unknown>, context: { profile: string }) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>;

  beforeEach(async () => {
    clearProviders();
    registerProvider(new OpenSpecProvider());

    process.env.HERMES_PROJECTS_BASE = '/tmp/nonexistent-test-projects';
    const mod = await import('../src/tools.js?t=' + Date.now());
    toolDefs = mod.toolDefs;
    const def = toolDefs.find(t => t.name === 'hb_import_spec');
    assert.ok(def, 'hb_import_spec tool should be defined');
    handler = def.handler as typeof handler;
  });

  it('returns error when no board, project, or repo provided', async () => {
    const result = await handler({
      spec_ref: 'openspec:add-dark-mode',
      base_commit: 'abc123',
    }, { profile: 'orchestrator' });

    assert.equal(result.isError, true);
    const text = result.content[0].text;
    assert.ok(text.includes('Missing board'));
  });

  it('returns error when project does not exist', async () => {
    const result = await handler({
      spec_ref: 'openspec:add-dark-mode',
      base_commit: 'abc123',
      project: 'nonexistent-project',
    }, { profile: 'orchestrator' });

    assert.equal(result.isError, true);
    const text = result.content[0].text;
    assert.ok(text.includes('not found'));
  });

  it('returns error when repo does not match any project', async () => {
    const result = await handler({
      spec_ref: 'openspec:add-dark-mode',
      base_commit: 'abc123',
      repo: 'git@github.com:nonexistent/repo.git',
    }, { profile: 'orchestrator' });

    assert.equal(result.isError, true);
    const text = result.content[0].text;
    assert.ok(text.includes('No project matches repo'));
  });

  it('returns error when spec provider is unknown (no board/project/repo)', async () => {
    const result = await handler({
      spec_ref: 'unknown-provider:test',
      base_commit: 'abc123',
    }, { profile: 'orchestrator' });

    assert.equal(result.isError, true);
    const text = result.content[0].text;
    assert.ok(text.includes('Missing board'));
  });

  it('returns error when board given but repoUrl not derivable (unknown provider path)', async () => {
    const result = await handler({
      spec_ref: 'unknown-provider:test',
      base_commit: 'abc123',
      board: 'test-board',
    }, { profile: 'orchestrator' });

    assert.equal(result.isError, true);
    const text = result.content[0].text;
    assert.ok(text.includes('repo_url'));
  });

  it('returns error for speckit provider (not yet implemented) with nonexistent project', async () => {
    const { SpeckitProvider } = await import('../src/spec-providers/speckit.js');
    registerProvider(new SpeckitProvider());

    const result = await handler({
      spec_ref: 'speckit:feature/42',
      base_commit: 'abc123',
      project: 'nonexistent',
    }, { profile: 'orchestrator' });

    assert.equal(result.isError, true);
    const text = result.content[0].text;
    assert.ok(text.includes('not found'));
  });

  it('returns error when board provided but repoUrl cannot be determined', async () => {
    const result = await handler({
      spec_ref: 'openspec:add-dark-mode',
      base_commit: 'abc123',
      board: 'test-board',
    }, { profile: 'orchestrator' });

    assert.equal(result.isError, true);
    const text = result.content[0].text;
    assert.ok(text.includes('repo_url'));
  });
});
