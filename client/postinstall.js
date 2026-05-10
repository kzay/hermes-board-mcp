#!/usr/bin/env node
/**
 * Copies canonical Hermes Board skills into .cursor/skills/board/.
 * Also scaffolds hermes-board.json if absent.
 * Existing files are never overwritten.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INSTALL_ROOT = resolve(process.env.INIT_CWD || process.cwd());
const TARGET_BASE = resolve(INSTALL_ROOT, '.cursor', 'skills', 'board');
const BOARD_CONFIG_PATH = resolve(INSTALL_ROOT, 'hermes-board.json');

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

function copyMissingTree(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });

  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyMissingTree(srcPath, destPath);
      continue;
    }

    if (!entry.isFile()) continue;

    if (!existsSync(destPath)) {
      copyFileSync(srcPath, destPath);
      console.log(`  copied: ${destPath}`);
    } else {
      console.log(`  exists: ${destPath} (skipped)`);
    }
  }
}

function copySkill(skillName) {
  const srcDir = join(__dirname, 'skills', skillName);
  const srcPath = join(srcDir, 'SKILL.md');
  const destDir = join(TARGET_BASE, skillName);

  if (!existsSync(srcPath) || !statSync(srcPath).isFile()) {
    throw new Error(`missing canonical skill file: ${srcPath}`);
  }

  copyMissingTree(srcDir, destDir);
}

try {
  console.log('[hermes-board-skills] Installing canonical hb-* Cursor skills...');
  mkdirSync(TARGET_BASE, { recursive: true });

  for (const skillName of CANONICAL_SKILLS) copySkill(skillName);

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
