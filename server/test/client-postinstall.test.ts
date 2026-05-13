import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';

function runPostinstall(cwd: string, env?: Record<string, string | undefined>) {
  const root = fileURLToPath(new URL('../../..', import.meta.url));
  const mergedEnv = { ...process.env, ...env };
  return spawnSync(process.execPath, [join(root, 'client', 'postinstall.js')], {
    cwd,
    env: mergedEnv,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function clientRoot(): string {
  return fileURLToPath(new URL('../../..', import.meta.url));
}

describe('client postinstall', () => {
  it('copies nested skill reference files without requiring manual copy steps', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'hb-client-install-'));
    const result = runPostinstall(tmp, { INIT_CWD: undefined });

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.ok(existsSync(join(tmp, '.cursor', 'skills', 'board', 'hb-deploy', 'SKILL.md')));
    assert.ok(
      existsSync(join(tmp, '.cursor', 'skills', 'board', 'hb-deploy', 'references', 'providers', 'openspec.md')),
      'postinstall should copy provider reference files nested under a skill'
    );
  });

  it('uses INIT_CWD as the target project during npm lifecycle installs', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'hb-client-init-cwd-'));
    const packageRoot = join(clientRoot(), 'client');
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

  it('writes a version marker after fresh install', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'hb-client-marker-'));
    const result = runPostinstall(tmp, { INIT_CWD: undefined });

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const markerPath = join(tmp, '.cursor', 'skills', 'board', '.hermes-board-skills-version');
    assert.ok(existsSync(markerPath), 'version marker should exist after install');

    const marker = readFileSync(markerPath, 'utf8').trim();
    assert.ok(marker.length > 0, 'version marker should not be empty');
  });

  it('overwrites stale skill files on version upgrade', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'hb-client-upgrade-'));

    const firstRun = runPostinstall(tmp, { INIT_CWD: undefined });
    assert.equal(firstRun.status, 0, `first run failed: ${firstRun.stdout}\n${firstRun.stderr}`);

    const skillPath = join(tmp, '.cursor', 'skills', 'board', 'hb-deploy', 'SKILL.md');
    assert.ok(existsSync(skillPath), 'skill file should exist after first install');
    const originalContent = readFileSync(skillPath, 'utf8');

    const staleContent = '# stale-sentinel\nOld skill content that should be replaced.';
    writeFileSync(skillPath, staleContent, 'utf8');

    const markerPath = join(tmp, '.cursor', 'skills', 'board', '.hermes-board-skills-version');
    writeFileSync(markerPath, '0.0.0', 'utf8');

    const secondRun = runPostinstall(tmp, { INIT_CWD: undefined });
    assert.equal(secondRun.status, 0, `second run failed: ${secondRun.stdout}\n${secondRun.stderr}`);

    const updatedContent = readFileSync(skillPath, 'utf8');
    assert.notEqual(updatedContent, staleContent, 'skill file should be overwritten on upgrade');
    assert.equal(updatedContent, originalContent, 'skill file should match the canonical source');
  });

  it('skips copy when version marker matches current package version', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'hb-client-skip-'));

    const firstRun = runPostinstall(tmp, { INIT_CWD: undefined });
    assert.equal(firstRun.status, 0, `first run failed: ${firstRun.stdout}\n${firstRun.stderr}`);

    const secondRun = runPostinstall(tmp, { INIT_CWD: undefined });
    assert.equal(secondRun.status, 0, `second run failed: ${secondRun.stdout}\n${secondRun.stderr}`);

    const output = secondRun.stdout + secondRun.stderr;
    assert.ok(output.includes('already at'), 'should report skills are already current');
  });

  it('does not overwrite hermes-board.json on upgrade', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'hb-client-config-'));

    const firstRun = runPostinstall(tmp, { INIT_CWD: undefined });
    assert.equal(firstRun.status, 0);

    const configPath = join(tmp, 'hermes-board.json');
    const customConfig = '{"config_version":1,"project":{"slug":"my-real-project"}}';
    writeFileSync(configPath, customConfig, 'utf8');

    const markerPath = join(tmp, '.cursor', 'skills', 'board', '.hermes-board-skills-version');
    writeFileSync(markerPath, '0.0.0', 'utf8');

    const secondRun = runPostinstall(tmp, { INIT_CWD: undefined });
    assert.equal(secondRun.status, 0);

    const afterUpgrade = readFileSync(configPath, 'utf8');
    assert.equal(afterUpgrade, customConfig, 'hermes-board.json must not be overwritten on upgrade');
  });
});
