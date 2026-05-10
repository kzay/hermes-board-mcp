/**
 * hermes-board-mcp MCP server — StreamableHTTP transport on port 7332.
 *
 * Endpoints:
 *   GET  /health  → 200 {"status":"ok","service":"hermes-board-mcp"}
 *   POST /mcp     → JSON-RPC 2.0 MCP messages (auth required for non-loopback)
 *
 * X-Hermes-Profile header identifies the calling agent profile.
 * Bearer token authentication is enforced for external requests.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import http from 'http';
import crypto from 'crypto';
import { toolDefs } from './tools.js';
import { initPolicy, checkAccess, PolicyViolationError } from './policy.js';
import { authenticateRequest, initAuth } from './auth.js';
import { initSpecProviders } from './spec-providers/index.js';

const PORT = parseInt(process.env.PORT || '7332', 10);
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

initPolicy();
initAuth();
initSpecProviders();

interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  profile: string;
  createdAt: number;
}

const sessions = new Map<string, Session>();

function pruneExpiredSessions() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, s] of sessions) {
    if (s.createdAt < cutoff) {
      s.transport.close?.();
      sessions.delete(id);
    }
  }
}

function createMcpServer(profile: string) {
  const server = new McpServer({
    name: 'hermes-board-mcp',
    version: '3.0.0',
  });

  for (const tool of toolDefs) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema,
      async (args: Record<string, unknown>) => {
        checkAccess(profile, tool.name);
        return tool.handler(args, { profile });
      }
    );
  }

  return server;
}

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'hermes-board-mcp' }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/tools') {
    const names = toolDefs.map(t => ({ name: t.name, description: t.description }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tools: names, count: names.length }));
    return;
  }

  if (url.pathname === '/mcp') {
    const authResult = authenticateRequest(req);
    if (!authResult.ok) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: authResult.error }));
      return;
    }

    const profile = authResult.profile || req.headers['x-hermes-profile'] || 'default';

    if (req.method === 'POST') {
      const existingSessionId = req.headers['mcp-session-id'];

      try {
        const rawBody = await readBody(req);
        const parsedBody = JSON.parse(rawBody.toString('utf8'));

        if (typeof existingSessionId === 'string' && sessions.has(existingSessionId)) {
          const session = sessions.get(existingSessionId)!;
          await session.transport.handleRequest(req, res, parsedBody);
          return;
        }

        pruneExpiredSessions();

        let assignedSessionId: string | undefined;
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => {
            assignedSessionId = crypto.randomUUID();
            return assignedSessionId;
          },
        });

        const server = createMcpServer(String(profile));
        await server.connect(transport);
        await transport.handleRequest(req, res, parsedBody);

        if (assignedSessionId) {
          sessions.set(assignedSessionId, {
            transport,
            server,
            profile: String(profile),
            createdAt: Date.now(),
          });
        }
      } catch (err) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
        console.error('[hermes-board-mcp] error handling POST:', (err as Error).message);
      }
      return;
    }

    if (req.method === 'DELETE') {
      const sid = req.headers['mcp-session-id'];
      if (typeof sid === 'string' && sessions.has(sid)) {
        sessions.get(sid)!.transport.close?.();
        sessions.delete(sid);
      }
      res.writeHead(200);
      res.end();
      return;
    }

    res.writeHead(405);
    res.end();
    return;
  }

  res.writeHead(404);
  res.end();
});

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const MAX_BODY = 1024 * 1024; // 1 MB
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Request body exceeds 1MB limit'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function startServer() {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[hermes-board-mcp] MCP server listening on port ${PORT}`);
    console.log(`[hermes-board-mcp] health: http://127.0.0.1:${PORT}/health`);
    console.log(`[hermes-board-mcp] mcp:    http://127.0.0.1:${PORT}/mcp`);
  });
}

process.on('SIGTERM', () => {
  console.log('[hermes-board-mcp] SIGTERM — shutting down');
  httpServer.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  httpServer.close(() => process.exit(0));
});

// Auto-start when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
