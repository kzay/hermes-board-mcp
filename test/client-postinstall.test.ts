import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import { existsSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';

describe('client postinstall', () => {
  it('copies nested skill reference files without requiring manual copy steps', () => {
    const root = fileURLToPath(new URL('../..', import.meta.url));
    const tmp = mkdtempSync(join(tmpdir(), 'hb-client-install-'));
    const env = { ...process.env };
    delete env.INIT_CWD;
    const result = spawnSync(process.execPath, [join(root, 'client', 'postinstall.js')], {
      cwd: tmp,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.ok(existsSync(join(tmp, '.cursor', 'skills', 'board', 'hb-deploy', 'SKILL.md')));
    assert.ok(
      existsSync(join(tmp, '.cursor', 'skills', 'board', 'hb-deploy', 'references', 'providers', 'openspec.md')),
      'postinstall should copy provider reference files nested under a skill'
    );
  });

  it('uses INIT_CWD as the target project during npm lifecycle installs', () => {
    const root = fileURLToPath(new URL('../..', import.meta.url));
    const tmp = mkdtempSync(join(tmpdir(), 'hb-client-init-cwd-'));
    const packageRoot = join(root, 'client');
    const result = spawnSync(process.execPath, [join(packageRoot, 'postinstall.js')], {
      cwd: packageRoot,
      env: { ...process.env, INIT_CWD: tmp },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.ok(
      existsSync(join(tmp, '.cursor', 'skills', 'board', 'hb-deploy', 'references', 'providers', 'openspec.md')),
      'postinstall should target npm INIT_CWD rather than the package directory'
    );
    assert.ok(existsSync(join(tmp, 'hermes-board.json')));
  });
});
