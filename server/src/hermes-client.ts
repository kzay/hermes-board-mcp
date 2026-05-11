/**
 * HermesKanbanClient — hybrid REST + CLI transport.
 *
 * Per-call REST attempt with CLI fallback.
 * Caches REST failures for 30 seconds to avoid connection thrashing.
 * Rejects non-loopback REST URLs by default (security guard).
 */
import { runCommand } from './command-runner.js';

const DEFAULT_API_URL = 'http://127.0.0.1:9119/api/plugins/kanban';
const FAILURE_CACHE_MS = 30_000;

export class RestError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly url: string,
    public readonly method: string,
  ) {
    super(`${method} ${url} → ${status} ${statusText}`);
    this.name = 'RestError';
  }

  get isClientError(): boolean { return this.status >= 400 && this.status < 500; }
  get isServerError(): boolean { return this.status >= 500; }
  /** 401/403 — auth issue, not a request error; CLI fallback should still work */
  get isAuthError(): boolean { return this.status === 401 || this.status === 403; }
}

interface FailureEntry {
  timestamp: number;
}

class RestFailureCache {
  private cache = new Map<string, FailureEntry>();

  get isRestUnavailable() {
    const now = Date.now();
    for (const [url, entry] of this.cache) {
      if (now - entry.timestamp < FAILURE_CACHE_MS) {
        return true;
      }
      this.cache.delete(url);
    }
    return false;
  }

  recordFailure() {
    this.cache.set('default', { timestamp: Date.now() });
  }

  clear() {
    this.cache.clear();
  }
}

export class HermesKanbanClient {
  private failureCache = new RestFailureCache();
  private baseUrl: string;
  private allowRemote: boolean;
  private apiToken: string | undefined;
  private warnedOnce = false;
  /** Set to true after the first successful REST call in this process */
  public restUsed = false;

  constructor() {
    this.baseUrl = (process.env.HERMES_KANBAN_API_URL || DEFAULT_API_URL).replace(/\/$/, '');
    this.allowRemote = process.env.HERMES_KANBAN_API_ALLOW_REMOTE === '1';
    this.apiToken = process.env.HERMES_KANBAN_API_TOKEN || undefined;
  }

  /**
   * Try REST for a given HTTP method + path. If it fails or is blocked,
   * fall back to CLI via `cliFallback`.
   */
  async tryRest(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    query?: Record<string, string | boolean | number | undefined>
  ): Promise<unknown> {
    if (this.failureCache.isRestUnavailable) {
      throw new Error('REST cached-unavailable');
    }

    if (!this.allowRemote) {
      const hostname = new URL(this.baseUrl).hostname;
      if (!this.isLoopback(hostname)) {
        throw new Error(`Remote REST URL rejected: ${this.baseUrl}`);
      }
    }

    // Append path to baseUrl (preserve base path like /api/plugins/kanban)
    const base = this.baseUrl.replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(base + cleanPath);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }

    const fetchOpts: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {}),
      },
    };
    if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
      fetchOpts.body = JSON.stringify(body);
    }

    try {
      const res = await fetch(url, fetchOpts);
      if (!res.ok) {
        throw new RestError(res.status, res.statusText, url.toString(), method);
      }
      const data = await res.json() as unknown;
      this.failureCache.clear();
      this.restUsed = true;
      return data;
    } catch (err) {
      if (err instanceof RestError && err.isClientError && !err.isAuthError) {
        throw err;
      }
      this.failureCache.recordFailure();
      if (!this.warnedOnce) {
        this.warnedOnce = true;
        console.log(`[hermes-board-mcp] dashboard REST unreachable at ${this.baseUrl} — using CLI fallback`);
      }
      throw err;
    }
  }

  async cliFallback(args: string[], opts?: { cwd?: string }): Promise<unknown> {
    const { stdout } = await runCommand('hermes', args, { cwd: opts?.cwd });
    try {
      return JSON.parse(stdout);
    } catch {
      return { raw: stdout };
    }
  }

  private isLoopback(hostname: string): boolean {
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
  }

  dispose(): void {
    this.failureCache.clear();
  }
}
