import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

describe('tool input validation', () => {
  let toolDefs: typeof import('../src/tools.js').toolDefs;

  beforeEach(async () => {
    const mod = await import('../src/tools.js?t=' + Date.now());
    toolDefs = mod.toolDefs;
  });

  describe('hb_list_tasks', () => {
    it('schema rejects invalid status value', () => {
      const def = toolDefs.find(t => t.name === 'hb_list_tasks');
      assert.ok(def, 'hb_list_tasks should be defined');

      const schema = z.object(def.inputSchema);
      const parseResult = schema.safeParse({
        board: 'test-board',
        status: 'invalid_status_value',
      });
      assert.equal(parseResult.success, false, 'should reject invalid status');
    });

    it('schema accepts valid status value', () => {
      const def = toolDefs.find(t => t.name === 'hb_list_tasks');
      assert.ok(def, 'hb_list_tasks should be defined');

      const schema = z.object(def.inputSchema);
      const parseResult = schema.safeParse({
        board: 'test-board',
        status: 'todo',
      });
      assert.equal(parseResult.success, true, 'should accept valid status');
    });
  });

  describe('hb_import_spec', () => {
    it('schema rejects non-hex base_commit', () => {
      const def = toolDefs.find(t => t.name === 'hb_import_spec');
      assert.ok(def, 'hb_import_spec should be defined');

      const schema = z.object(def.inputSchema);
      const parseResult = schema.safeParse({
        spec_ref: 'openspec:test',
        base_commit: 'zzzz-not-hex!',
        board: 'test-board',
      });
      assert.equal(parseResult.success, false, 'should reject non-hex base_commit');
    });

    it('schema accepts valid hex base_commit', () => {
      const def = toolDefs.find(t => t.name === 'hb_import_spec');
      assert.ok(def, 'hb_import_spec should be defined');

      const schema = z.object(def.inputSchema);
      const parseResult = schema.safeParse({
        spec_ref: 'openspec:test',
        base_commit: 'abc1234def5678',
        board: 'test-board',
      });
      assert.equal(parseResult.success, true, 'should accept valid hex base_commit');
    });
  });
});
