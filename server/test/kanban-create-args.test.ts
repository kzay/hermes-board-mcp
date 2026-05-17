import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCreateCliArgs, buildCreateRestBody, buildTailCliArgs } from '../src/tools.js';

describe('buildCreateCliArgs', () => {
  const BASE = { board: 'proj', title: 'My Task' };

  it('maps skills to repeatable --skill flags', () => {
    const args = { ...BASE, skills: ['senior-eng', 'quant-trader'] };
    const cli = buildCreateCliArgs(args, '');
    assert.ok(!cli.includes('--skills'), 'must use singular --skill, not plural --skills');
    const skillIndices = cli.reduce<number[]>((acc, v, i) => (v === '--skill' ? [...acc, i] : acc), []);
    assert.equal(skillIndices.length, 2, 'should have two --skill flags');
    assert.equal(cli[skillIndices[0] + 1], 'senior-eng');
    assert.equal(cli[skillIndices[1] + 1], 'quant-trader');
  });

  it('includes standard routing flags', () => {
    const args = {
      ...BASE,
      assignee: 'builder',
      workspace: 'scratch',
      priority: 2,
      tenant: 'acme',
      max_runtime: '2h',
      idempotency_key: 'key-1',
    };
    const cli = buildCreateCliArgs(args, 'task body');
    assert.ok(cli.includes('--assignee'), 'should include --assignee');
    assert.ok(cli.includes('builder'));
    assert.ok(cli.includes('--workspace'));
    assert.ok(cli.includes('scratch'));
    assert.ok(cli.includes('--priority'));
    assert.ok(cli.includes('2'));
    assert.ok(cli.includes('--tenant'));
    assert.ok(cli.includes('acme'));
    assert.ok(cli.includes('--max-runtime'));
    assert.ok(cli.includes('2h'));
    assert.ok(cli.includes('--idempotency-key'));
    assert.ok(cli.includes('key-1'));
    assert.ok(cli.includes('--body'));
    assert.ok(cli.includes('--json'));
  });

  it('includes --triage when triage is true', () => {
    const cli = buildCreateCliArgs({ ...BASE, triage: true }, '');
    assert.ok(cli.includes('--triage'));
  });

  it('omits --triage when triage is false/undefined', () => {
    assert.ok(!buildCreateCliArgs({ ...BASE, triage: false }, '').includes('--triage'));
    assert.ok(!buildCreateCliArgs(BASE, '').includes('--triage'));
  });

  it('starts with kanban --board <board> create <title>', () => {
    const cli = buildCreateCliArgs(BASE, '');
    assert.deepEqual(cli.slice(0, 5), ['kanban', '--board', 'proj', 'create', 'My Task']);
  });

  it('ends with --json', () => {
    const cli = buildCreateCliArgs(BASE, '');
    assert.equal(cli[cli.length - 1], '--json');
  });
});

describe('buildTailCliArgs', () => {
  it('does not include --json', () => {
    const cli = buildTailCliArgs({ task_id: 't_abc123' });
    assert.ok(!cli.includes('--json'), 'CLI args must not contain --json');
  });

  it('does not include --lines', () => {
    const cli = buildTailCliArgs({ board: 'proj', task_id: 't_abc123' });
    assert.ok(!cli.includes('--lines'), 'CLI args must not contain --lines');
  });

  it('produces kanban tail <task_id> without board', () => {
    const cli = buildTailCliArgs({ task_id: 't_abc123' });
    assert.deepEqual(cli, ['kanban', 'tail', 't_abc123']);
  });

  it('inserts --board before tail when board is provided', () => {
    const cli = buildTailCliArgs({ board: 'hummingbot', task_id: 't_eaab03f6' });
    assert.deepEqual(cli, ['kanban', '--board', 'hummingbot', 'tail', 't_eaab03f6']);
  });

  it('omits --board when board is undefined', () => {
    const cli = buildTailCliArgs({ task_id: 't_xyz' });
    assert.ok(!cli.includes('--board'));
  });
});

describe('buildCreateRestBody', () => {
  const BASE = { board: 'proj', title: 'My Task' };

  it('includes skills in the REST body when provided', () => {
    const body = buildCreateRestBody(
      { ...BASE, skills: ['senior-eng', 'quant-trader'] },
      '',
    );
    assert.deepEqual(body.skills, ['senior-eng', 'quant-trader']);
  });

  it('omits skills from REST body when empty array', () => {
    const body = buildCreateRestBody({ ...BASE, skills: [] }, '');
    assert.equal(body.skills, undefined);
  });

  it('omits skills from REST body when undefined', () => {
    const body = buildCreateRestBody(BASE, '');
    assert.equal(body.skills, undefined);
  });

  it('includes standard fields', () => {
    const body = buildCreateRestBody(
      { ...BASE, assignee: 'builder', workspace: 'scratch', priority: 1 },
      'the body',
    );
    assert.equal(body.title, 'My Task');
    assert.equal(body.body, 'the body');
    assert.equal(body.assignee, 'builder');
    assert.equal(body.workspace, 'scratch');
    assert.equal(body.priority, 1);
  });
});
