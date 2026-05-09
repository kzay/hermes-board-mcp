#!/usr/bin/env node
/**
 * Copies board skills into .cursor/skills/board/ after npm install.
 * Also scaffolds hermes-board.json if absent.
 * Does NOT overwrite existing files — safe to re-run.
 */
import { readdirSync, copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const SKILLS_SRC = new URL('./skills', import.meta.url).pathname;
const TARGET_BASE = resolve(process.cwd(), '.cursor', 'skills', 'board');
const BOARD_CONFIG_PATH = resolve(process.cwd(), 'hermes-board.json');

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

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (!existsSync(destPath)) {
      copyFileSync(srcPath, destPath);
      console.log(`  copied: ${destPath}`);
    } else {
      console.log(`  exists: ${destPath} (skipped)`);
    }
  }
}

try {
  console.log('[hermes-board-skills] Installing Cursor skills...');
  copyDir(SKILLS_SRC, TARGET_BASE);

  if (!existsSync(BOARD_CONFIG_PATH)) {
    writeFileSync(BOARD_CONFIG_PATH, BOARD_CONFIG_PLACEHOLDER, 'utf8');
    console.log(`  created: ${BOARD_CONFIG_PATH}`);
    console.log('[hermes-board-skills] Edit hermes-board.json before using deploy/monitor skills.');
  } else {
    console.log(`  exists: ${BOARD_CONFIG_PATH} (skipped)`);
  }

  console.log('[hermes-board-skills] Done. See AGENTS.md for configuration steps.');
} catch (err) {
  console.warn(`[hermes-board-skills] WARN: could not copy skills: ${err.message}`);
  console.warn('[hermes-board-skills] You can manually copy skills/ to .cursor/skills/board/');
}
