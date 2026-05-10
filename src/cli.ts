#!/usr/bin/env node
/**
 * CLI entry point for hermes-board-mcp.
 * Usage: hermes-board-mcp [start] [--port 7332] [--policy-file policy.yaml] [--env-file .env]
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createRequire } from 'module';

const args = process.argv.slice(2);
const req = createRequire(import.meta.url);
const pkg = req('../../package.json') as { version: string };

function flag(name: string, fallback: string | null): string | null {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
}

const port = flag('--port', null);
const policyFile = flag('--policy-file', null);
const envFile = flag('--env-file', null);

if (envFile) {
  try {
    const lines = readFileSync(resolve(envFile), 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (err) {
    console.error(`[hermes-board-mcp] WARN: could not read env file (${envFile}): ${(err as Error).message}`);
  }
}

if (port) process.env.PORT = port;
if (policyFile) process.env.BOARD_MCP_POLICY = policyFile;

// Handle standalone flags before positional args
if (args.includes('--version') || args.includes('-v')) {
  console.log(pkg.version);
  process.exit(0);
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`hermes-board-mcp v${pkg.version} — Hermes Board MCP server

Usage:
  hermes-board-mcp [start] [options]

Options:
  --port <port>           Listen port (default: 7332, or $PORT)
  --policy-file <path>    Policy YAML file (default: ./policy.yaml)
  --env-file <path>       Load environment variables from file
  -v, --version           Print version
  -h, --help              Show this help

Environment Variables:
  PORT                    Listen port (default: 7332)
  BOARD_MCP_TOKENS        Comma-separated bearer tokens (token or token:profile)
  BOARD_MCP_POLICY        Path to policy YAML file
  BOARD_MCP_REQUIRE_AUTH  Set to "always" to require auth on loopback too
`);
  process.exit(0);
}

const positionalArgs = args.filter(a => !a.startsWith('--') && a !== port && a !== policyFile && a !== envFile);
const command = positionalArgs[0] || 'start';

if (command === 'start') {
  const { startServer } = await import('./index.js');
  startServer();
} else if (command === 'init') {
  const starter = {
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
      aliases: ['git@github.com:YOU/YOUR_REPO.git'],
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
  };
  console.log(JSON.stringify(starter, null, 2));
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
