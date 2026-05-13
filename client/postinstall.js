#!/usr/bin/env node
/**
 * Copies canonical Hermes Board skills into .cursor/skills/board/.
 * Also scaffolds hermes-board.json if absent.
 *
 * On fresh install: copies all skill files.
 * On upgrade: overwrites skill files so updates are applied;
 *             hermes-board.json is never overwritten (user-owned config).
 *
 * A .hermes-board-skills-version marker tracks which package version
 * last wrote the skills.  When the marker matches the current version
 * the copy is skipped entirely for speed.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INSTALL_ROOT = resolve(process.env.INIT_CWD || process.cwd());
const TARGET_BASE = resolve(INSTALL_ROOT, '.cursor', 'skills', 'board');
const BOARD_CONFIG_PATH = resolve(INSTALL_ROOT, 'hermes-board.json');
const VERSION_MARKER_PATH = join(TARGET_BASE, '.hermes-board-skills-version');

function readPackageVersion() {
  const pkgPath = join(__dirname, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    return null;
  }
}

function readMarkerVersion() {
  if (!existsSync(VERSION_MARKER_PATH)) return null;
  try {
    return readFileSync(VERSION_MARKER_PATH, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

function writeMarkerVersion(version) {
  writeFileSync(VERSION_MARKER_PATH, version, 'utf8');
}

const CANONICAL_SKILLS = [
  'hb-deploy',
  'hb-monitor',
  'hb-plan',
  'hb-worker',
  'hb-release',
];

const BOARD_CONFIG_PLACEHOLDER = JSON.stringify({
  config_version: 1,
  $schema: 'https://hermes-agent.nousresearch.com/schemas/hermes-board.json',
  server: {
    url: 'https://hermes-board-mcp.example.com/mcp',
    profile: 'orchestrator',
  },
  project: {
    slug: 'YOUR_PROJECT_SLUG',
    board: 'YOUR_PROJECT_SLUG',
  },
  repo: {
    url: 'https://github.com/YOU/YOUR_REPO.git',
    aliases: [
      'git@github.com:YOU/YOUR_REPO.git',
    ],
    default_branch: 'main',
  },
  defaults: {
    assignee: 'builder',
    workspace: 'scratch',
    max_runtime: '2h',
    skills: [],
    tenant: null,
    priority: null,
  },
  openspec: {
    root: 'openspec/',
  },
}, null, 2);

function copyTree(srcDir, destDir, overwrite) {
  mkdirSync(destDir, { recursive: true });

  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyTree(srcPath, destPath, overwrite);
      continue;
    }

    if (!entry.isFile()) continue;

    const destExists = existsSync(destPath);
    if (!destExists || overwrite) {
      copyFileSync(srcPath, destPath);
      console.log(`  ${destExists ? 'updated' : 'copied'}: ${destPath}`);
    } else {
      console.log(`  exists: ${destPath} (skipped)`);
    }
  }
}

function copySkill(skillName, overwrite) {
  const srcDir = join(__dirname, 'skills', skillName);
  const srcPath = join(srcDir, 'SKILL.md');
  const destDir = join(TARGET_BASE, skillName);

  if (!existsSync(srcPath) || !statSync(srcPath).isFile()) {
    throw new Error(`missing canonical skill file: ${srcPath}`);
  }

  copyTree(srcDir, destDir, overwrite);
}

try {
  const packageVersion = readPackageVersion();
  const installedVersion = readMarkerVersion();
  const isUpgrade = installedVersion != null && installedVersion !== packageVersion;
  const isFresh = installedVersion == null;
  const alreadyCurrent = packageVersion != null && installedVersion === packageVersion;

  if (alreadyCurrent) {
    console.log(`[hermes-board-skills] Skills already at v${packageVersion}, skipping.`);
  } else {
    const overwrite = isUpgrade;
    const verb = isUpgrade ? `Upgrading skills from v${installedVersion} to v${packageVersion}` : 'Installing canonical hb-* Cursor skills';
    console.log(`[hermes-board-skills] ${verb}...`);

    mkdirSync(TARGET_BASE, { recursive: true });
    for (const skillName of CANONICAL_SKILLS) copySkill(skillName, overwrite);

    if (packageVersion) writeMarkerVersion(packageVersion);
  }

  if (!existsSync(BOARD_CONFIG_PATH)) {
    writeFileSync(BOARD_CONFIG_PATH, BOARD_CONFIG_PLACEHOLDER, 'utf8');
    console.log(`  created: ${BOARD_CONFIG_PATH}`);
    console.log('[hermes-board-skills] Edit hermes-board.json before using deploy/monitor skills.');
  } else {
    console.log(`  exists: ${BOARD_CONFIG_PATH} (skipped)`);
  }

  console.log('[hermes-board-skills] Done. See client/AGENTS.md for configuration steps.');
} catch (err) {
  console.warn(`[hermes-board-skills] WARN: could not copy skills: ${err.message}`);
  console.warn('[hermes-board-skills] You can manually copy client/skills/hb-* to .cursor/skills/board/');
}
