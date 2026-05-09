/**
 * Bearer-token authentication for hermes-board-mcp.
 *
 * Reads BOARD_MCP_TOKENS env var (comma-separated, optional :<profile> suffix).
 * Loopback requests (127.0.0.1, ::1) bypass auth unless BOARD_MCP_REQUIRE_AUTH=always.
 * Supports SIGHUP for hot-reload of token list.
 */

import type { IncomingMessage } from 'http';

let _tokens = new Map<string, string | null>(); // token → profile | null

function parseTokens(): Map<string, string | null> {
  const raw = process.env.BOARD_MCP_TOKENS || '';
  const map = new Map<string, string | null>();
  if (!raw.trim()) return map;

  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      map.set(trimmed.slice(0, colonIdx), trimmed.slice(colonIdx + 1));
    } else {
      map.set(trimmed, null);
    }
  }
  return map;
}

function loadTokens() {
  _tokens = parseTokens();
  const count = _tokens.size;
  if (count === 0) {
    console.log('[auth] WARN: no tokens configured — loopback-only access');
  } else {
    console.log(`[auth] loaded ${count} token(s)`);
  }
}

export function initAuth() {
  loadTokens();
  process.on('SIGHUP', () => {
    console.log('[auth] SIGHUP received — reloading tokens');
    loadTokens();
  });
}

function isLoopback(req: IncomingMessage): boolean {
  const addr = req.socket?.remoteAddress || '';
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

export interface AuthResult {
  ok: boolean;
  profile?: string | null;
  error?: string;
}

function getHeaderString(req: IncomingMessage, header: string): string | undefined {
  const val = req.headers[header.toLowerCase()];
  if (Array.isArray(val)) return val[0];
  return val;
}

export function authenticateRequest(req: IncomingMessage): AuthResult {
  const requireAlways = process.env.BOARD_MCP_REQUIRE_AUTH === 'always';

  if (!requireAlways && isLoopback(req)) {
    return { ok: true, profile: getHeaderString(req, 'x-hermes-profile') || null };
  }

  const authHeader = getHeaderString(req, 'authorization') || '';
  if (!authHeader) {
    return { ok: false, error: 'missing authorization' };
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, error: 'invalid authorization format' };
  }

  const token = match[1].trim();
  if (!_tokens.has(token)) {
    return { ok: false, error: 'invalid token' };
  }

  const boundProfile = _tokens.get(token);
  return { ok: true, profile: boundProfile ?? null };
}
