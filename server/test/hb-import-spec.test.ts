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

  it('returns error for speckit provider with nonexistent project', async () => {
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

  it('speckit provider builds correct body via direct buildBody call', async () => {
    const { SpeckitProvider } = await import('../src/spec-providers/speckit.js');
    const provider = new SpeckitProvider();

    const body = provider.buildBody('speckit:feature/42', {
      repoUrl: 'git@github.com:org/repo.git',
      baseBranch: 'main',
      baseCommit: 'abc123def456',
    });

    assert.ok(body.includes('spec_provider: speckit'));
    assert.ok(body.includes('spec_ref: speckit:feature/42'));
    assert.ok(body.includes('spec_path: speckit/specs/feature/42/'));
    assert.ok(body.includes('repo_url: git@github.com:org/repo.git'));
    assert.ok(body.includes('base_commit: abc123def456'));
  });

  it('forwards spec_base_path to provider via BuildBodyOpts', async () => {
    const { SpeckitProvider } = await import('../src/spec-providers/speckit.js');
    const provider = new SpeckitProvider();

    const body = provider.buildBody('speckit:my-feature', {
      repoUrl: 'https://github.com/org/repo',
      baseBranch: 'main',
      baseCommit: 'deadbeef',
      specBasePath: 'override/path/',
    });

    assert.ok(body.includes('spec_path: override/path/specs/my-feature/'));
    assert.ok(!body.includes('speckit/specs/'));
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
