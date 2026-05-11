import { execSync } from 'child_process';
import { resolve, join } from 'path';
import { existsSync, mkdirSync, writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';

// ── Configuration ────────────────────────────────────────────────

const MCP_URL = process.env.MCP_SERVER_URL || 'http://mcp-hermes:7332';
const MCP_TOKEN = process.env.MCP_AUTH_TOKEN || 'e2e-test-token';

// ── Type helpers ─────────────────────────────────────────────────

export interface McpSession {
  close(): Promise<void>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  listTools(): Promise<Array<{ name: string; description?: string }>>;
}

export interface OpenSpecTask {
  title: string;
  body?: string;
}

// ── MCP session helpers ──────────────────────────────────────────

export async function createMcpSession(): Promise<McpSession> {
  let sessionId = '';
  let reqId = 0;

  async function rpc(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const body: Record<string, unknown> = {
      jsonrpc: '2.0',
      id: ++reqId,
      method,
    };
    if (params) body.params = params;

    const res = await fetch(`${MCP_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${MCP_TOKEN}`,
        ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
      },
      body: JSON.stringify(body),
    });

    if (res.status === 401) {
      throw new Error('MCP unauthorized');
    }

    let data: Record<string, unknown>;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      const text = await res.text();
      // Extract the last "data: {...}" line and parse it as JSON.
      // SSE events look like: event: message\ndata: {...}\n\n
      const lines = text.split(/\r?\n/).filter(l => l.startsWith('data: '));
      const lastLine = lines[lines.length - 1]?.slice(6) ?? '{}';
      data = JSON.parse(lastLine) as Record<string, unknown>;
    } else {
      data = (await res.json()) as Record<string, unknown>;
    }

    if ('error' in data && data.error) {
      const err = data.error as Record<string, unknown>;
      throw new Error(String(err.message || JSON.stringify(data.error)));
    }

    const sid = res.headers.get('mcp-session-id') || res.headers.get('Mcp-Session-Id');
    if (sid && !sessionId) {
      sessionId = sid;
    }

    return data.result as unknown;
  }

  // Initialize handshake (must come first)
  await rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'e2e-client', version: '1.0.0' },
  });

  // Send initialized notification
  const initRes = await fetch(`${MCP_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${MCP_TOKEN}`,
      ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  });
  // consume the response so the connection can close cleanly
  await initRes.text();

  return {
    async close() {
      await fetch(`${MCP_URL}/mcp`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${MCP_TOKEN}`,
          'Mcp-Session-Id': sessionId,
        },
      });
    },
    async callTool(name, args) {
      return rpc('tools/call', { name, arguments: args });
    },
    async listTools() {
      const result = (await rpc('tools/list', {})) as Record<string, unknown> | undefined;
      return (result?.tools as Array<{ name: string; description?: string }>) || [];
    },
  };
}

// ── HTTP transport helpers ───────────────────────────────────────

export async function httpHealth(): Promise<Record<string, unknown>> {
  const res = await fetch(`${MCP_URL}/health`);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function httpTools(): Promise<Record<string, unknown>> {
  const res = await fetch(`${MCP_URL}/tools`);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function httpPostUnauth(body: unknown): Promise<Response> {
  return fetch(`${MCP_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Result parsing helpers ───────────────────────────────────────

export function parseToolResult(result: unknown): Record<string, unknown> {
  const r = result as { content?: Array<{ type: string; text: string }> } | undefined;
  const text = r?.content?.[0]?.text ?? '{}';
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

// ── Git helpers ──────────────────────────────────────────────────

export function initGitRepo(dir: string): void {
  execSync('git init', { cwd: dir });
  execSync('git config user.email "e2e@example.com"', { cwd: dir });
  execSync('git config user.name "E2E Test"', { cwd: dir });
}

export function commitAll(dir: string, message: string): void {
  execSync('git add -A', { cwd: dir });
  execSync(`git commit -m "${message}"`, { cwd: dir });
}

export function getGitHead(dir: string): string {
  return execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8' }).trim();
}

// ── OpenSpec helpers ─────────────────────────────────────────────

export function createOpenSpecChange(dir: string, name: string, tasks: OpenSpecTask[]): void {
  const changeDir = join(dir, 'openspec', 'changes', name);
  mkdirSync(changeDir, { recursive: true });

  const proposalContent = [
    '## Why',
    'E2E test change for spec-provider dispatch.',
    '',
    '## What Changes',
    '- Test the dispatch flow from OpenSpec to kanban',
    '',
    '## Capabilities',
    '### New Capabilities',
    '- Test dispatch capability',
    '',
    '## Impact',
    '- E2E test coverage',
  ].join('\n');

  const tasksContent = [`## ${name}`, ''].concat(
    tasks.map(t => `- [ ] ${t.title}`)
  ).join('\n');

  writeFileSync(join(changeDir, 'proposal.md'), proposalContent);
  writeFileSync(join(changeDir, 'tasks.md'), tasksContent);
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
