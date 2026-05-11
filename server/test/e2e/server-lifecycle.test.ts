import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  httpHealth,
  httpTools,
  httpPostUnauth,
  createMcpSession,
  parseToolResult,
} from './helpers.js';

describe('server lifecycle', () => {
  it('GET /health returns ok', async () => {
    const data = await httpHealth();
    assert.equal(data.status, 'ok');
    assert.equal(data.service, 'hermes-board-mcp');
  });

  it('GET /tools returns non-empty list including hb_import_spec', async () => {
    const data = await httpTools();
    const tools = data.tools as Array<{ name: string }> | undefined;
    assert.ok(Array.isArray(tools), 'tools should be an array');
    assert.ok((tools ?? []).length > 0, 'tools should not be empty');
    const names = (tools ?? []).map((t) => t.name);
    assert.ok(names.includes('hb_import_spec'), 'should include hb_import_spec');
    assert.ok(names.includes('hb_create_task'), 'should include hb_create_task');
    assert.ok(names.includes('hb_list_tasks'), 'should include hb_list_tasks');
  });

  it('unauthenticated POST /mcp from non-loopback returns 401', async () => {
    const res = await httpPostUnauth({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'e2e-client', version: '1.0.0' },
      },
    });
    assert.equal(res.status, 401);
  });

  it('authenticated MCP session supports tools/list and tools/call', async () => {
    const session = await createMcpSession();
    try {
      const tools = await session.listTools();
      assert.ok(tools.length > 0, 'should have tools');
      const toolNames = tools.map((t) => t.name);
      assert.ok(
        toolNames.includes('hb_import_spec'),
        'should have hb_import_spec'
      );

      // Verify tools/call works (use hb_list_boards which is read-only)
      const result = await session.callTool('hb_list_boards', {});
      const data = parseToolResult(result);
      assert.ok(
        Array.isArray(data.raw) || Array.isArray(data),
        'hb_list_boards should return an array-like result'
      );
    } finally {
      await session.close();
    }
  });
});
