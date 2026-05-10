import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createMcpSession, parseToolResult } from './helpers.js';
import type { McpSession } from './helpers.js';

const BOARD_NAME = 'e2e-crud-board';

let session: McpSession;
let taskId = '';

before(async () => {
  session = await createMcpSession();
});

after(async () => {
  if (session) {
    await session.close();
  }
});

describe('dashboard REST API', () => {
  it('dashboard REST endpoints return JSON', async () => {
    // Verify the dashboard REST API is directly accessible and functional
    const dashboardUrl = 'http://mcp-hermes:9119/api/plugins/kanban';

    const boardsRes = await fetch(`${dashboardUrl}/boards`);
    assert.equal(boardsRes.status, 200);
    const boardsData = await boardsRes.json() as Record<string, unknown>;
    assert.ok(Array.isArray(boardsData.boards), 'boards endpoint should return { boards: [...] }');
  });
});

describe('kanban CRUD', () => {
  it('hb_create_board creates a board', async () => {
    const result = await session.callTool('hb_create_board', {
      board: BOARD_NAME,
      description: 'E2E CRUD test board',
    });
    const data = parseToolResult(result);
    // Hermes kanban boards create may return minimal output or nothing on CLI
    assert.ok(data, 'should return a result');
  });

  it('hb_create_task creates a task', async () => {
    const result = await session.callTool('hb_create_task', {
      board: BOARD_NAME,
      title: 'E2E test task',
      assignee: 'test-profile',
      workspace: 'scratch',
    });
    const data = parseToolResult(result);
    assert.ok(data, 'should return a result');
    if (data.id) {
      taskId = String(data.id);
    }
  });

  it('hb_list_tasks shows the created task', async () => {
    const result = await session.callTool('hb_list_tasks', {
      board: BOARD_NAME,
    });
    const data = parseToolResult(result);

    let tasks: Array<Record<string, unknown>> = [];
    if (Array.isArray(data)) {
      tasks = data;
    } else if (data.raw && Array.isArray(data.raw)) {
      tasks = data.raw as Array<Record<string, unknown>>;
    }

    assert.ok(tasks.length > 0, 'should find at least one task');
    const titles = tasks.map((t) => String(t.title || ''));
    assert.ok(
      titles.some((t) => t.includes('E2E test task')),
      'created task should appear in list'
    );

    // Capture task id if not already set
    if (!taskId) {
      const found = tasks.find((t) =>
        String(t.title || '').includes('E2E test task')
      );
      if (found && found.id) {
        taskId = String(found.id);
      }
    }

    assert.ok(taskId, 'taskId should be captured for subsequent tests');
  });

  it('hb_show_task shows the task details', async () => {
    assert.ok(taskId, 'taskId is required');
    const result = await session.callTool('hb_show_task', {
      board: BOARD_NAME,
      task_id: taskId,
    });
    const data = parseToolResult(result);
    const title = String(data.title || '');
    assert.ok(
      title.includes('E2E test task'),
      'show task should return correct task'
    );
  });

  it('hb_assign_task updates assignee', async () => {
    assert.ok(taskId, 'taskId is required');
    const result = await session.callTool('hb_assign_task', {
      board: BOARD_NAME,
      task_id: taskId,
      assignee: 'reassigned-profile',
    });
    const data = parseToolResult(result);
    assert.ok(data, 'assign should succeed');

    // Verify
    const showResult = await session.callTool('hb_show_task', {
      board: BOARD_NAME,
      task_id: taskId,
    });
    const showData = parseToolResult(showResult);
    assert.equal(showData.assignee, 'reassigned-profile');
  });

  it('hb_block_task blocks the task', async () => {
    assert.ok(taskId, 'taskId is required');
    const result = await session.callTool('hb_block_task', {
      board: BOARD_NAME,
      task_id: taskId,
      reason: 'Blocked for E2E testing',
    });
    const data = parseToolResult(result);
    assert.ok(data, 'block should succeed');

    // Verify
    const showResult = await session.callTool('hb_show_task', {
      board: BOARD_NAME,
      task_id: taskId,
    });
    const showData = parseToolResult(showResult);
    assert.equal(showData.status, 'blocked');
  });

  it('hb_unblock_task unblocks the task', async () => {
    assert.ok(taskId, 'taskId is required');
    const result = await session.callTool('hb_unblock_task', {
      board: BOARD_NAME,
      task_id: taskId,
    });
    assert.ok(parseToolResult(result), 'unblock should succeed');

    // Verify
    const showResult = await session.callTool('hb_show_task', {
      board: BOARD_NAME,
      task_id: taskId,
    });
    const showData = parseToolResult(showResult);
    assert.equal(showData.status, 'ready');
  });

  it('hb_complete_task completes the task', async () => {
    assert.ok(taskId, 'taskId is required');
    const result = await session.callTool('hb_complete_task', {
      board: BOARD_NAME,
      task_id: taskId,
      summary: 'Completed in E2E test',
    });
    assert.ok(parseToolResult(result), 'complete should succeed');

    // Verify
    const showResult = await session.callTool('hb_show_task', {
      board: BOARD_NAME,
      task_id: taskId,
    });
    const showData = parseToolResult(showResult);
    assert.equal(showData.status, 'done');
  });

  it('hb_archive_task archives the task', async () => {
    assert.ok(taskId, 'taskId is required');
    const result = await session.callTool('hb_archive_task', {
      board: BOARD_NAME,
      task_id: taskId,
    });
    assert.ok(parseToolResult(result), 'archive should succeed');

    // Verify
    const showResult = await session.callTool('hb_show_task', {
      board: BOARD_NAME,
      task_id: taskId,
    });
    const showData = parseToolResult(showResult);
    assert.equal(showData.status, 'archived');
  });

  it('dashboard REST API is actively used (not CLI fallback)', async () => {
    // hb_create_task uses tryRestThenCli — with the fixed URL this hits REST
    // The client.restUsed flag is set permanently after first successful REST call
    const healthResult = await session.callTool('hb_health', {});
    const health = parseToolResult(healthResult);
    assert.equal(health.status, 'ok');
    assert.equal(
      health.dashboard_rest_used,
      true,
      'dashboard REST should be used; got: ' + JSON.stringify(health)
    );
  });
});
