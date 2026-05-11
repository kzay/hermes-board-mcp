import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('globMatch', () => {
  let globMatch: typeof import('../src/policy.js').globMatch;

  beforeEach(async () => {
    const mod = await import('../src/policy.js?t=' + Date.now());
    globMatch = mod.globMatch;
  });

  it('matches exact string', () => {
    assert.equal(globMatch('hb_list_boards', 'hb_list_boards'), true);
  });

  it('rejects different exact string', () => {
    assert.equal(globMatch('hb_list_boards', 'hb_create_task'), false);
  });

  it('matches hb_* wildcard', () => {
    assert.equal(globMatch('hb_*', 'hb_list_boards'), true);
    assert.equal(globMatch('hb_*', 'hb_create_task'), true);
    assert.equal(globMatch('hb_*', 'hb_health'), true);
  });

  it('rejects non-matching wildcard', () => {
    assert.equal(globMatch('hb_*', 'other_tool'), false);
  });

  it('matches partial wildcard hb_list_*', () => {
    assert.equal(globMatch('hb_list_*', 'hb_list_boards'), true);
    assert.equal(globMatch('hb_list_*', 'hb_list_tasks'), true);
    assert.equal(globMatch('hb_list_*', 'hb_create_task'), false);
  });

  it('matches ? single-char wildcard', () => {
    assert.equal(globMatch('hb_?', 'hb_x'), true);
    assert.equal(globMatch('hb_?', 'hb_ab'), false);
  });

  it('handles no wildcards as exact match', () => {
    assert.equal(globMatch('exact', 'exact'), true);
    assert.equal(globMatch('exact', 'exactx'), false);
  });
});

describe('policy', () => {
  let checkAccess: typeof import('../src/policy.js').checkAccess;
  let initPolicy: typeof import('../src/policy.js').initPolicy;
  let PolicyViolationError: typeof import('../src/policy.js').PolicyViolationError;

  beforeEach(async () => {
    process.env.BOARD_MCP_POLICY = join(__dirname, '..', '..', 'policy.yaml');
    const mod = await import('../src/policy.js?t=' + Date.now());
    checkAccess = mod.checkAccess;
    initPolicy = mod.initPolicy;
    PolicyViolationError = mod.PolicyViolationError;
    initPolicy();
  });

  it('allows planner to call hb_list_boards', () => {
    assert.doesNotThrow(() => checkAccess('planner', 'hb_list_boards'));
  });

  it('allows orchestrator to call hb_create_task', () => {
    assert.doesNotThrow(() => checkAccess('orchestrator', 'hb_create_task'));
  });

  it('denies builder from calling hb_create_board', () => {
    assert.throws(
      () => checkAccess('builder', 'hb_create_board'),
      PolicyViolationError
    );
  });

  it('denies unknown profile', () => {
    assert.throws(
      () => checkAccess('hacker', 'hb_list_boards'),
      PolicyViolationError
    );
  });

  it('allows builder to call hb_send_heartbeat', () => {
    assert.doesNotThrow(() => checkAccess('builder', 'hb_send_heartbeat'));
  });

  it('denies default profile from calling hb_send_heartbeat', () => {
    assert.throws(
      () => checkAccess('default', 'hb_send_heartbeat'),
      PolicyViolationError
    );
  });

  it('allows default profile to call hb_list_boards', () => {
    assert.doesNotThrow(() => checkAccess('default', 'hb_list_boards'));
  });

  it('allows default profile to call hb_health', () => {
    assert.doesNotThrow(() => checkAccess('default', 'hb_health'));
  });

  it('allows builder profile to call hb_health', () => {
    assert.doesNotThrow(() => checkAccess('builder', 'hb_health'));
  });

  it('denies default profile from calling hb_create_task', () => {
    assert.throws(
      () => checkAccess('default', 'hb_create_task'),
      PolicyViolationError
    );
  });
});
