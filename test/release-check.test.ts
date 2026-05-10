import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  CANONICAL_CLIENT_SKILLS,
  findStaleReferences,
  parseNpmPackFiles,
  validateClientPackFiles,
} from '../scripts/release-check.js';

describe('release readiness checks', () => {
  it('defines the canonical client skill package surface', () => {
    assert.deepEqual(CANONICAL_CLIENT_SKILLS, [
      'hb-deploy',
      'hb-monitor',
      'hb-plan',
      'hb-worker',
      'hb-release',
    ]);
  });

  it('accepts a client package that contains only canonical hb skills', () => {
    const files = [
      'package.json',
      'skills/hb-deploy/SKILL.md',
      'skills/hb-monitor/SKILL.md',
      'skills/hb-plan/SKILL.md',
      'skills/hb-worker/SKILL.md',
      'skills/hb-release/SKILL.md',
    ];

    assert.deepEqual(validateClientPackFiles(files), []);
  });

  it('rejects packages missing canonical skills or shipping stale openspec skills', () => {
    const files = [
      'package.json',
      'skills/hb-deploy/SKILL.md',
      'skills/openspec-deploy/SKILL.md',
    ];

    const errors = validateClientPackFiles(files);
    assert.match(errors.join('\n'), /Missing client skill: skills\/hb-monitor\/SKILL\.md/);
    assert.match(errors.join('\n'), /Stale client skill must not ship: skills\/openspec-deploy\/SKILL\.md/);
  });

  it('parses npm pack dry-run output into file paths', () => {
    const output = [
      'npm notice Tarball Contents',
      'npm notice 1.0kB package.json',
      'npm notice 2.0kB skills/hb-deploy/SKILL.md',
      'npm notice Tarball Details',
    ].join('\n');

    assert.deepEqual(parseNpmPackFiles(output), [
      'package.json',
      'skills/hb-deploy/SKILL.md',
    ]);
  });

  it('detects stale active release references while allowing historical paths', () => {
    const root = mkdtempSync(join(tmpdir(), 'hb-release-check-'));
    mkdirSync(join(root, 'client'), { recursive: true });
    mkdirSync(join(root, 'openspec', 'changes', 'archive', 'old'), { recursive: true });

    writeFileSync(join(root, 'README.md'), 'Use hb_import_openspec today\n', 'utf8');
    writeFileSync(join(root, 'client', 'README.md'), 'Install openspec-deploy now\n', 'utf8');
    writeFileSync(
      join(root, 'openspec', 'changes', 'archive', 'old', 'proposal.md'),
      'Historical hb_import_openspec reference\n',
      'utf8'
    );

    const findings = findStaleReferences(root);
    const rendered = findings.map(f => `${f.relativePath}:${f.pattern}`).join('\n');
    assert.match(rendered, /README\.md:hb_import_openspec/);
    assert.match(rendered, /client\/README\.md:openspec-deploy/);
    assert.doesNotMatch(rendered, /archive\/old\/proposal\.md/);
  });
});
