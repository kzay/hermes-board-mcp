import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  createMcpSession,
  parseToolResult,
  initGitRepo,
  commitAll,
  getGitHead,
  createOpenSpecChange,
} from './helpers.js';
import type { McpSession } from './helpers.js';

const CHANGE_NAME = 'e2e-dispatch-test';

let session: McpSession;
let tmpDir = '';

before(async () => {
  session = await createMcpSession();
});

after(async () => {
  if (session) {
    await session.close();
  }
  if (tmpDir) {
    try {
      // Clean up temp git repo
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
});

describe('openspec dispatch', () => {
  it('creates git repo, constructs OpenSpec change, and dispatches via hb_import_spec', async () => {
    // 1. Create temporary directory for git repo
    tmpDir = mkdtempSync(join(tmpdir(), 'e2e-openspec-'));

    // 2. Initialize git repo
    initGitRepo(tmpDir);

    // 3. Create a source file to commit
    writeFileSync(join(tmpDir, 'README.md'), '# E2E Test Project\n');

    // 4. Construct OpenSpec change programmatically
    createOpenSpecChange(tmpDir, CHANGE_NAME, [
      { title: 'First test task' },
      { title: 'Second test task' },
    ]);

    // 5. Commit everything
    commitAll(tmpDir, 'Add OpenSpec change for E2E dispatch test');

    // 6. Get HEAD commit hash
    const headCommit = getGitHead(tmpDir);
    assert.ok(/^[0-9a-f]{40}$/i.test(headCommit), 'HEAD should be a valid commit hash');

    // 7. Call hb_import_spec to dispatch the change
    const result = await session.callTool('hb_import_spec', {
      spec_ref: `openspec:${CHANGE_NAME}`,
      base_commit: headCommit,
      project: 'e2e-test',
    });
    const data = parseToolResult(result);

    // Verify task was created
    assert.ok(data.id, `should return a task id, got: ${JSON.stringify(data)}`);

    // 8. Verify task title follows the spec import convention
    assert.equal(data.title, `[spec] ${CHANGE_NAME}`, 'task title should be [spec] <change-name>');

    // 9. Verify task body contains the hermes-board-spec fence with metadata
    const body = String(data.body || '');
    assert.ok(body.includes('```hermes-board-spec'), 'body should contain hermes-board-spec fence');
    assert.ok(body.includes('spec_provider: openspec'), 'body should include spec_provider');
    assert.ok(
      body.includes(`spec_ref: openspec:${CHANGE_NAME}`),
      'body should include spec_ref'
    );
    assert.ok(
      body.includes(`spec_path: openspec/changes/${CHANGE_NAME}/`),
      'body should include spec_path'
    );
    assert.ok(
      body.includes(`base_commit: ${headCommit}`),
      'body should include base_commit'
    );
    assert.ok(body.includes('repo_url:'), 'body should include repo_url');
    assert.ok(body.includes('base_branch: main'), 'body should include base_branch');

    // Store task id for subsequent idempotency test
    const firstTaskId = String(data.id);

    // 10. Verify idempotency: calling again should not create a duplicate
    const result2 = await session.callTool('hb_import_spec', {
      spec_ref: `openspec:${CHANGE_NAME}`,
      base_commit: headCommit,
      project: 'e2e-test',
    });
    const data2 = parseToolResult(result2);

    if (data2.id) {
      assert.equal(
        data2.id,
        firstTaskId,
        'second dispatch should return the same task (idempotent)'
      );
    }
  });
});
