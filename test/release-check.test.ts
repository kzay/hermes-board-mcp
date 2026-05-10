import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  CANONICAL_CLIENT_SKILLS,
  findStaleReferences,
  parseNpmPackFiles,
  validateClientSkillSources,
  validateClientPackFiles,
  validateReleaseMetadata,
  validateRootPackFiles,
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
      'CHANGELOG.md',
      'LICENSE',
      'package.json',
      'skills/hb-deploy/SKILL.md',
      'skills/hb-deploy/references/providers/openspec.md',
      'skills/evals/routing.json',
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

  it('rejects packages missing provider references or routing evals', () => {
    const files = [
      'package.json',
      'skills/hb-deploy/SKILL.md',
      'skills/hb-monitor/SKILL.md',
      'skills/hb-plan/SKILL.md',
      'skills/hb-worker/SKILL.md',
      'skills/hb-release/SKILL.md',
    ];

    const errors = validateClientPackFiles(files);
    assert.match(errors.join('\n'), /Missing client package file: skills\/hb-deploy\/references\/providers\/openspec\.md/);
    assert.match(errors.join('\n'), /Missing client package file: skills\/evals\/routing\.json/);
  });

  it('requires production root package files', () => {
    const files = [
      'package.json',
      'README.md',
      'AGENTS.md',
      'CLAUDE.md',
      'policy.yaml',
    ];

    const errors = validateRootPackFiles(files);
    assert.match(errors.join('\n'), /Missing root package file: LICENSE/);
    assert.match(errors.join('\n'), /Missing root package file: CHANGELOG\.md/);
    assert.match(errors.join('\n'), /Missing root package file: hermes-board-mcp\.service/);
  });

  it('detects version drift in release metadata and active docs', () => {
    const root = mkdtempSync(join(tmpdir(), 'hb-version-check-'));
    mkdirSync(join(root, 'client'), { recursive: true });

    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '3.3.0' }), 'utf8');
    writeFileSync(join(root, 'client', 'package.json'), JSON.stringify({ version: '3.2.0' }), 'utf8');
    writeFileSync(
      join(root, 'package-lock.json'),
      JSON.stringify({ version: '3.2.0', packages: { '': { version: '3.2.0' } } }),
      'utf8'
    );
    writeFileSync(join(root, 'README.md'), '# hermes-board-mcp v3.2\n', 'utf8');

    const errors = validateReleaseMetadata(root);
    assert.match(errors.join('\n'), /Root and client package versions must match/);
    assert.match(errors.join('\n'), /package-lock\.json version must match/);
    assert.match(errors.join('\n'), /Stale active release version in README\.md/);
  });

  it('validates client skill frontmatter and routing eval references', () => {
    const root = mkdtempSync(join(tmpdir(), 'hb-skill-source-check-'));
    const skillsRoot = join(root, 'client', 'skills');
    for (const skill of CANONICAL_CLIENT_SKILLS) {
      mkdirSync(join(skillsRoot, skill), { recursive: true });
      writeFileSync(join(skillsRoot, skill, 'SKILL.md'), `# ${skill}\n`, 'utf8');
    }
    mkdirSync(join(skillsRoot, 'evals'), { recursive: true });
    writeFileSync(
      join(skillsRoot, 'evals', 'routing.json'),
      JSON.stringify({
        version: 1,
        cases: [
          {
            name: 'bad-reference',
            user_request: 'Deploy openspec:test',
            expected_skill: 'hb-deploy',
            should_not_load: ['hb-monitor'],
            expected_provider_reference: 'hb-deploy/references/providers/missing.md',
          },
        ],
      }),
      'utf8'
    );

    const errors = validateClientSkillSources(root);
    assert.match(errors.join('\n'), /Client skill hb-deploy must start with YAML frontmatter/);
    assert.match(errors.join('\n'), /Routing eval bad-reference references missing file/);
    assert.match(errors.join('\n'), /Missing routing eval case for client skill: hb-monitor/);
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
