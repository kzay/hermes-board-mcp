import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

describe('tool input validation', () => {
  let toolDefs: typeof import('../src/tools.js').toolDefs;

  beforeEach(async () => {
    const mod = await import('../src/tools.js?t=' + Date.now());
    toolDefs = mod.toolDefs;
  });

  function findTool(name: string) {
    const def = toolDefs.find(t => t.name === name);
    assert.ok(def, `${name} should be defined`);
    return { def, schema: z.object(def.inputSchema) };
  }

  describe('smoke: all new tools are registered', () => {
    const EXPECTED_NEW_TOOLS = [
      'hb_edit_task', 'hb_claim_task', 'hb_task_log', 'hb_task_context',
      'hb_init', 'hb_boards_switch', 'hb_boards_show', 'hb_boards_rename', 'hb_boards_rm',
      'hb_watch_events', 'hb_list_assignees', 'hb_gc',
      'hb_notify_subscribe', 'hb_notify_list', 'hb_notify_unsubscribe',
    ];

    for (const name of EXPECTED_NEW_TOOLS) {
      it(`${name} exists in toolDefs`, () => {
        assert.ok(toolDefs.find(t => t.name === name), `${name} should be registered`);
      });
    }
  });

  describe('hb_list_tasks', () => {
    it('schema rejects invalid status value', () => {
      const { schema } = findTool('hb_list_tasks');
      const parseResult = schema.safeParse({
        board: 'test-board',
        status: 'invalid_status_value',
      });
      assert.equal(parseResult.success, false, 'should reject invalid status');
    });

    it('schema accepts valid status value', () => {
      const { schema } = findTool('hb_list_tasks');
      const parseResult = schema.safeParse({
        board: 'test-board',
        status: 'todo',
      });
      assert.equal(parseResult.success, true, 'should accept valid status');
    });

    it('schema accepts assignee and mine params', () => {
      const { schema } = findTool('hb_list_tasks');
      assert.equal(schema.safeParse({ board: 'b', assignee: 'researcher' }).success, true);
      assert.equal(schema.safeParse({ board: 'b', mine: true }).success, true);
    });
  });

  describe('hb_import_spec', () => {
    it('schema rejects non-hex base_commit', () => {
      const { schema } = findTool('hb_import_spec');
      const parseResult = schema.safeParse({
        spec_ref: 'openspec:test',
        base_commit: 'zzzz-not-hex!',
        board: 'test-board',
      });
      assert.equal(parseResult.success, false, 'should reject non-hex base_commit');
    });

    it('schema accepts valid hex base_commit', () => {
      const { schema } = findTool('hb_import_spec');
      const parseResult = schema.safeParse({
        spec_ref: 'openspec:test',
        base_commit: 'abc1234def5678',
        board: 'test-board',
      });
      assert.equal(parseResult.success, true, 'should accept valid hex base_commit');
    });
  });

  describe('hb_edit_task', () => {
    it('schema accepts valid patch with title', () => {
      const { schema } = findTool('hb_edit_task');
      assert.equal(schema.safeParse({ task_id: 't_1', title: 'New' }).success, true);
    });

    it('schema accepts patch with multiple fields', () => {
      const { schema } = findTool('hb_edit_task');
      assert.equal(schema.safeParse({ task_id: 't_1', body: 'x', priority: 2 }).success, true);
    });

    it('schema requires task_id', () => {
      const { schema } = findTool('hb_edit_task');
      assert.equal(schema.safeParse({ title: 'New' }).success, false);
    });
  });

  describe('hb_complete_task (bulk + metadata)', () => {
    it('schema accepts task_ids array', () => {
      const { schema } = findTool('hb_complete_task');
      assert.equal(schema.safeParse({ board: 'b', task_ids: ['t_1', 't_2'] }).success, true);
    });

    it('schema accepts metadata record', () => {
      const { schema } = findTool('hb_complete_task');
      assert.equal(
        schema.safeParse({ board: 'b', task_id: 't_1', metadata: { changed_files: ['a.ts'] } }).success,
        true,
      );
    });
  });

  describe('hb_block_task (bulk)', () => {
    it('schema accepts task_ids array', () => {
      const { schema } = findTool('hb_block_task');
      assert.equal(schema.safeParse({ board: 'b', task_ids: ['t_1'], reason: 'needs input' }).success, true);
    });
  });

  describe('hb_unblock_task (bulk)', () => {
    it('schema accepts task_ids array', () => {
      const { schema } = findTool('hb_unblock_task');
      assert.equal(schema.safeParse({ board: 'b', task_ids: ['t_1', 't_2'] }).success, true);
    });
  });

  describe('hb_archive_task (bulk)', () => {
    it('schema accepts task_ids array', () => {
      const { schema } = findTool('hb_archive_task');
      assert.equal(schema.safeParse({ board: 'b', task_ids: ['t_1'] }).success, true);
    });
  });

  describe('hb_create_board (enhanced)', () => {
    it('schema accepts name, icon, color, switch_to', () => {
      const { schema } = findTool('hb_create_board');
      assert.equal(
        schema.safeParse({ board: 'my-proj', name: 'My Project', icon: '🚀', color: '#ff0', switch_to: true }).success,
        true,
      );
    });
  });

  describe('hb_claim_task', () => {
    it('schema accepts task_id with optional ttl', () => {
      const { schema } = findTool('hb_claim_task');
      assert.equal(schema.safeParse({ task_id: 't_1' }).success, true);
      assert.equal(schema.safeParse({ task_id: 't_1', ttl: 3600 }).success, true);
    });
  });

  describe('hb_boards_rm', () => {
    it('schema accepts delete_permanently flag', () => {
      const { schema } = findTool('hb_boards_rm');
      assert.equal(schema.safeParse({ board: 'old', delete_permanently: true }).success, true);
      assert.equal(schema.safeParse({ board: 'old' }).success, true);
    });
  });

  describe('hb_gc', () => {
    it('schema accepts retention day params', () => {
      const { schema } = findTool('hb_gc');
      assert.equal(schema.safeParse({ event_retention_days: 30, log_retention_days: 7 }).success, true);
      assert.equal(schema.safeParse({}).success, true);
    });
  });

  describe('hb_notify_subscribe', () => {
    it('schema requires platform and chat_id', () => {
      const { schema } = findTool('hb_notify_subscribe');
      assert.equal(schema.safeParse({ task_id: 't_1' }).success, false, 'missing platform');
      assert.equal(
        schema.safeParse({ task_id: 't_1', platform: 'telegram', chat_id: '123' }).success,
        true,
      );
    });

    it('schema accepts optional thread_id and user_id', () => {
      const { schema } = findTool('hb_notify_subscribe');
      assert.equal(
        schema.safeParse({ task_id: 't_1', platform: 'slack', chat_id: 'C1', thread_id: 'ts_1', user_id: 'U1' }).success,
        true,
      );
    });
  });

  describe('hb_watch_events', () => {
    it('schema accepts all optional filters', () => {
      const { schema } = findTool('hb_watch_events');
      assert.equal(
        schema.safeParse({ board: 'b', assignee: 'r', tenant: 't', kinds: 'completed,blocked', limit: 50 }).success,
        true,
      );
      assert.equal(schema.safeParse({}).success, true);
    });
  });
});
