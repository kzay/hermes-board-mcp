import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

  it('allows planner to call kanban_boards_list', () => {
    assert.doesNotThrow(() => checkAccess('planner', 'kanban_boards_list'));
  });

  it('allows orchestrator to call openspec_push', () => {
    assert.doesNotThrow(() => checkAccess('orchestrator', 'openspec_push'));
  });

  it('denies builder from calling openspec_push', () => {
    assert.throws(
      () => checkAccess('builder', 'openspec_push'),
      PolicyViolationError
    );
  });

  it('denies unknown profile', () => {
    assert.throws(
      () => checkAccess('hacker', 'kanban_boards_list'),
      PolicyViolationError
    );
  });

  it('allows builder to call kanban_heartbeat', () => {
    assert.doesNotThrow(() => checkAccess('builder', 'kanban_heartbeat'));
  });

  it('denies default profile from calling kanban_heartbeat', () => {
    assert.throws(
      () => checkAccess('default', 'kanban_heartbeat'),
      PolicyViolationError
    );
  });

  it('allows default profile to call kanban_boards_list', () => {
    assert.doesNotThrow(() => checkAccess('default', 'kanban_boards_list'));
  });

  it('denies default profile from calling kanban_create', () => {
    assert.throws(
      () => checkAccess('default', 'kanban_create'),
      PolicyViolationError
    );
  });
});
