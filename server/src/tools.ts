/**
 * MCP tool definitions for hermes-board-mcp v2.
 *
 * All kanban tools mirror Hermes's worker CLI surface.
 * Hybrid transport: HermesKanbanClient tries REST first, falls back to CLI.
 */
import { z } from 'zod';
import { resolveProject, resolveProjectByRepo } from './project.js';
import { HermesKanbanClient, RestError } from './hermes-client.js';
import { resolveProvider } from './spec-providers/registry.js';

export const client = new HermesKanbanClient();

export const VALID_STATUSES = ['triage', 'todo', 'ready', 'running', 'blocked', 'done', 'archived'] as const;

// ── utilities ─────────────────────────────────────────────────────
export function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function textResult(content: unknown) {
  return { content: [{ type: 'text' as const, text: typeof content === 'string' ? content : JSON.stringify(content, null, 2) }] };
}

function errorResult(msg: string) {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
}

async function tryRestThenCli<T>(
  restCall: () => Promise<unknown>,
  cliCall: () => Promise<unknown>
): Promise<T> {
  try {
    return await restCall() as T;
  } catch (err) {
    if (err instanceof RestError && err.isClientError && !err.isAuthError) {
      throw err;
    }
    const classification = err instanceof RestError ? `HTTP ${err.status}` : 'network error';
    console.warn(`[hermes-board-mcp] REST failed (${classification}), falling back to CLI`);
    return await cliCall() as T;
  }
}

function resolveTaskIds(taskId: unknown, taskIds: unknown): string[] | null {
  if (Array.isArray(taskIds) && taskIds.length > 0) return taskIds.map(String);
  if (taskId !== undefined && taskId !== null) return [String(taskId)];
  return null;
}

async function bulkLifecycle(
  board: string,
  ids: string[],
  status: string,
  extra?: Record<string, unknown>,
): Promise<ReturnType<typeof textResult>> {
  const restBody: Record<string, unknown> = { ids, status, ...extra };
  try {
    const data = await client.tryRest('POST', '/tasks/bulk', restBody, { board });
    return textResult(data);
  } catch {
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const id of ids) {
      try {
        const cliArgs = ['kanban', '--board', board, status === 'done' ? 'complete' : status === 'blocked' ? 'block' : status === 'ready' ? 'unblock' : 'archive', id];
        if (extra?.summary) cliArgs.push('--summary', String(extra.summary));
        if (extra?.result) cliArgs.push('--result', String(extra.result));
        if (extra?.reason) cliArgs.push(String(extra.reason));
        await client.cliFallback(cliArgs);
        results.push({ id, ok: true });
      } catch (err) {
        results.push({ id, ok: false, error: (err as Error).message });
      }
    }
    return textResult(results);
  }
}

function isValidStatus(s: string | undefined): s is typeof VALID_STATUSES[number] {
  if (!s) return false;
  return VALID_STATUSES.includes(s as typeof VALID_STATUSES[number]);
}

function extractTaskList(result: unknown): Array<Record<string, unknown>> | null {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  if (!result || typeof result !== 'object') return null;

  const obj = result as Record<string, unknown>;
  if (Array.isArray(obj.tasks)) return obj.tasks as Array<Record<string, unknown>>;

  if (Array.isArray(obj.columns)) {
    const tasks: Array<Record<string, unknown>> = [];
    for (const column of obj.columns as Array<Record<string, unknown>>) {
      if (Array.isArray(column.tasks)) {
        tasks.push(...(column.tasks as Array<Record<string, unknown>>));
      }
    }
    return tasks;
  }

  return null;
}

// ── OpenSpec metadata block ──────────────────────────────────────
function formatOpenSpecBlock(fields: { spec_ref?: string; acceptance_criteria?: string; test_command?: string; human_gate_required?: string }) {
  const lines: string[] = [];
  if (fields.spec_ref !== undefined) lines.push(`spec_ref: ${fields.spec_ref}`);
  if (fields.acceptance_criteria !== undefined) lines.push(`acceptance_criteria: ${fields.acceptance_criteria}`);
  if (fields.test_command !== undefined) lines.push(`test_command: ${fields.test_command}`);
  if (fields.human_gate_required !== undefined) lines.push(`human_gate_required: ${fields.human_gate_required}`);
  if (!lines.length) return '';
  return '```hermes-board-spec\n' + lines.join('\n') + '\n```';
}

// ── Core hb_create_task (shared by hb_create_task and hb_import_spec) ──
interface KanbanCreateArgs {
  board: string;
  title: string;
  body?: string;
  assignee?: string;
  parents?: string[];
  tenant?: string;
  priority?: number;
  workspace?: string;
  triage?: boolean;
  idempotency_key?: string;
  max_runtime?: string;
  skills?: string[];
  spec_ref?: string;
  acceptance_criteria?: string;
  test_command?: string;
  human_gate_required?: string;
}

async function kanbanCreateCore(args: KanbanCreateArgs): Promise<ReturnType<typeof textResult>> {
  const board = args.board;
  const title = args.title;

  const metaBlock = formatOpenSpecBlock({
    spec_ref: args.spec_ref,
    acceptance_criteria: args.acceptance_criteria,
    test_command: args.test_command,
    human_gate_required: args.human_gate_required,
  });
  const baseBody = args.body || '';
  const fullBody = baseBody && metaBlock ? `${baseBody}\n\n${metaBlock}` : baseBody || metaBlock || '';

  const restBody: Record<string, unknown> = { title };
  if (fullBody) restBody.body = fullBody;
  if (args.triage !== undefined) restBody.triage = args.triage;
  if (args.parents !== undefined && args.parents.length) restBody.parents = args.parents;
  if (args.assignee !== undefined) restBody.assignee = args.assignee;
  if (args.tenant !== undefined) restBody.tenant = args.tenant;
  if (args.priority !== undefined) restBody.priority = args.priority;
  if (args.workspace !== undefined) restBody.workspace = args.workspace;
  if (args.idempotency_key !== undefined) restBody.idempotency_key = args.idempotency_key;
  if (args.max_runtime !== undefined) restBody.max_runtime = args.max_runtime;
  if (args.skills !== undefined && args.skills.length) restBody.skills = args.skills;

  const restPromise = () => client.tryRest('POST', '/tasks', restBody, { board });

  const cliArgs = ['kanban', '--board', board, 'create', title];
  if (fullBody) cliArgs.push('--body', fullBody);
  if (args.assignee !== undefined) cliArgs.push('--assignee', args.assignee);
  if (args.tenant !== undefined) cliArgs.push('--tenant', args.tenant);
  if (args.priority !== undefined) cliArgs.push('--priority', String(args.priority));
  if (args.workspace !== undefined) cliArgs.push('--workspace', args.workspace);
  if (args.triage) cliArgs.push('--triage');
  if (args.idempotency_key !== undefined) cliArgs.push('--idempotency-key', args.idempotency_key);
  if (args.max_runtime !== undefined) cliArgs.push('--max-runtime', args.max_runtime);
  if (args.skills !== undefined && args.skills.length) cliArgs.push('--skills', args.skills.join(','));
  cliArgs.push('--json');
  const cliPromise = () => client.cliFallback(cliArgs);

  const result = await tryRestThenCli(restPromise, cliPromise);
  // REST returns { task: {...}, created: true } — unwrap to match CLI flat format
  if (result && typeof result === 'object' && 'task' in result) {
    return textResult((result as Record<string, unknown>).task);
  }
  return textResult(result);
}

// ── Tool definitions ──────────────────────────────────────────────
export interface ToolDef {
  name: string;
  description: string;
  inputSchema: z.ZodRawShape;
  handler: (args: Record<string, unknown>, context: { profile: string }) => Promise<ReturnType<typeof textResult>>;
}

export const toolDefs: ToolDef[] = [
  // ── Board-level ──────────────────────────────────────────────────
  {
    name: 'hb_list_boards',
    description: 'List all kanban boards.',
    inputSchema: {},
    async handler() {
      const result = await client.cliFallback(['kanban', 'boards', 'list', '--json']);
      return textResult(result);
    },
  },

  // ── Health / introspection ─────────────────────────────────────
  {
    name: 'hb_health',
    description: 'Return MCP server health status including whether dashboard REST is being used.',
    inputSchema: {},
    async handler() {
      return textResult({
        status: 'ok',
        service: 'hermes-board-mcp',
        dashboard_rest_used: client.restUsed,
        dashboard_url: process.env.HERMES_KANBAN_API_URL || 'http://127.0.0.1:9119/api/plugins/kanban',
      });
    },
  },

  {
    name: 'hb_create_board',
    description: 'Create a new kanban board.',
    inputSchema: {
      board: z.string().describe('Slug for the new board (kebab-case)'),
      name: z.string().optional().describe('Display name'),
      description: z.string().optional().describe('Board description'),
      icon: z.string().optional().describe('Board icon (emoji)'),
      color: z.string().optional().describe('Board color'),
      switch_to: z.boolean().optional().describe('Make this the active board after creation'),
    },
    async handler(args) {
      const board = String(args.board);
      const cmdArgs = ['kanban', 'boards', 'create', board];
      if (args.name) cmdArgs.push('--name', String(args.name));
      if (args.description) cmdArgs.push('--description', String(args.description));
      if (args.icon) cmdArgs.push('--icon', String(args.icon));
      if (args.color) cmdArgs.push('--color', String(args.color));
      if (args.switch_to) cmdArgs.push('--switch');
      const result = await client.cliFallback(cmdArgs);
      return textResult(result);
    },
  },

  // ── Task-level reads ────────────────────────────────────────────
  {
    name: 'hb_list_tasks',
    description: 'List tasks on a kanban board, optionally filtered by status, assignee, or metadata.',
    inputSchema: {
      board: z.string().describe('Board slug'),
      status: z.enum(VALID_STATUSES).optional().describe('Filter by status'),
      assignee: z.string().optional().describe('Filter by assignee profile'),
      mine: z.boolean().optional().describe('Show only tasks assigned to the current profile'),
      tenant: z.string().optional(),
      include_archived: z.boolean().optional(),
    },
    async handler(args) {
      const board = String(args.board);
      const query: Record<string, string | boolean | undefined> = { board };
      if (args.status) query.status = String(args.status);
      if (args.assignee) query.assignee = String(args.assignee);
      if (args.tenant) query.tenant = String(args.tenant);
      if (args.include_archived !== undefined) query.include_archived = Boolean(args.include_archived);

      const restPromise = () => client.tryRest('GET', '/board', undefined, query);
      const cliArgs = ['kanban', '--board', board, 'list', '--json'];
      if (args.status) cliArgs.push('--status', String(args.status));
      if (args.assignee) cliArgs.push('--assignee', String(args.assignee));
      if (args.mine) cliArgs.push('--mine');
      if (args.tenant) cliArgs.push('--tenant', String(args.tenant));
      const cliPromise = () => client.cliFallback(cliArgs);

      const result = await tryRestThenCli(restPromise, cliPromise);
      const tasks = extractTaskList(result);
      if (tasks) {
        const filtered = args.status ? tasks.filter(t => t.status === args.status) : tasks;
        const enriched = filtered.map(r => ({
          ...r,
          ...(resolveProject(String(r.slug || r.board)) || {}),
        }));
        return textResult(enriched);
      }
      return textResult(result);
    },
  },

  {
    name: 'hb_show_task',
    description: 'Show full details of a single kanban task.',
    inputSchema: {
      board: z.string().optional(),
      task_id: z.string().describe('Task ID'),
    },
    async handler(args) {
      const board = args.board ? String(args.board) : undefined;
      const rawId = String(args.task_id);
      const numericId = Number(rawId);
      const taskId = Number.isFinite(numericId) && numericId > 0 ? String(numericId) : rawId;
      const query = board ? { board } : undefined;

      const restPromise = () => client.tryRest('GET', `/tasks/${taskId}`, undefined, query);
      const cliArgs = ['kanban', '--board', board || '_', 'show', taskId, '--json'];
      const cliPromise = () => client.cliFallback(cliArgs);

      const result = await tryRestThenCli(restPromise, cliPromise);
      if (result && typeof result === 'object' && 'task' in result) {
        return textResult((result as Record<string, unknown>).task);
      }
      return textResult(result);
    },
  },

  // ── Task creation ────────────────────────────────────────────────
  {
    name: 'hb_create_task',
    description: 'Create a kanban task. OpenSpec metadata (spec_ref, acceptance_criteria, test_command, human_gate_required) is fenced in the body; routing fields use native Hermes flags.',
    inputSchema: {
      board: z.string(),
      title: z.string(),
      body: z.string().optional(),
      assignee: z.string().optional(),
      parents: z.array(z.string()).optional(),
      tenant: z.string().optional(),
      priority: z.number().int().optional(),
      workspace: z.union([z.literal('scratch'), z.literal('worktree'), z.string().regex(/^dir:/)]).optional(),
      triage: z.boolean().optional(),
      idempotency_key: z.string().optional(),
      max_runtime: z.string().optional(),
      skills: z.array(z.string()).optional(),
      spec_ref: z.string().optional(),
      acceptance_criteria: z.string().optional(),
      test_command: z.string().optional(),
      human_gate_required: z.enum(['yes', 'no']).optional(),
    },
    async handler(args) {
      return kanbanCreateCore({
        board: String(args.board),
        title: String(args.title),
        body: args.body ? String(args.body) : undefined,
        assignee: args.assignee ? String(args.assignee) : undefined,
        parents: Array.isArray(args.parents) ? args.parents.map(String) : undefined,
        tenant: args.tenant ? String(args.tenant) : undefined,
        priority: args.priority !== undefined ? Number(args.priority) : undefined,
        workspace: args.workspace ? String(args.workspace) : undefined,
        triage: args.triage !== undefined ? Boolean(args.triage) : undefined,
        idempotency_key: args.idempotency_key ? String(args.idempotency_key) : undefined,
        max_runtime: args.max_runtime ? String(args.max_runtime) : undefined,
        skills: Array.isArray(args.skills) ? args.skills.map(String) : undefined,
        spec_ref: args.spec_ref ? String(args.spec_ref) : undefined,
        acceptance_criteria: args.acceptance_criteria ? String(args.acceptance_criteria) : undefined,
        test_command: args.test_command ? String(args.test_command) : undefined,
        human_gate_required: args.human_gate_required ? String(args.human_gate_required) : undefined,
      });
    },
  },

  // ── Task transitions ─────────────────────────────────────────────
  {
    name: 'hb_complete_task',
    description: 'Complete one or more kanban tasks (status → done). Provide task_id for a single task or task_ids for bulk.',
    inputSchema: {
      board: z.string(),
      task_id: z.string().optional(),
      task_ids: z.array(z.string()).optional(),
      summary: z.string().optional(),
      result: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional().describe('Structured handoff metadata for downstream consumers'),
    },
    async handler(args) {
      const board = String(args.board);
      const ids = resolveTaskIds(args.task_id, args.task_ids);
      if (!ids) return errorResult('Provide task_id or task_ids');
      const summary = args.summary ? String(args.summary) : undefined;
      const result = args.result ? String(args.result) : undefined;
      const metadata = args.metadata as Record<string, unknown> | undefined;

      if (ids.length === 1) {
        const taskId = ids[0];
        const restBody: Record<string, unknown> = { status: 'done' };
        if (summary) restBody.summary = summary;
        if (result) restBody.result = result;
        if (metadata) restBody.metadata = metadata;

        const restPromise = () => client.tryRest('PATCH', `/tasks/${taskId}`, restBody, { board });
        const cliArgs = ['kanban', '--board', board, 'complete', taskId];
        if (summary) cliArgs.push('--summary', summary);
        if (result) cliArgs.push('--result', result);
        if (metadata) cliArgs.push('--metadata', JSON.stringify(metadata));
        const cliPromise = () => client.cliFallback(cliArgs);

        const data = await tryRestThenCli(restPromise, cliPromise);
        return textResult(data);
      }

      return bulkLifecycle(board, ids, 'done', { summary, result, metadata });
    },
  },

  {
    name: 'hb_block_task',
    description: 'Block one or more kanban tasks (status → blocked). Provide task_id for a single task or task_ids for bulk.',
    inputSchema: {
      board: z.string(),
      task_id: z.string().optional(),
      task_ids: z.array(z.string()).optional(),
      reason: z.string().describe('Blocking reason'),
    },
    async handler(args) {
      const board = String(args.board);
      const ids = resolveTaskIds(args.task_id, args.task_ids);
      if (!ids) return errorResult('Provide task_id or task_ids');
      const reason = String(args.reason);

      if (ids.length === 1) {
        const restBody = { status: 'blocked', reason };
        const restPromise = () => client.tryRest('PATCH', `/tasks/${ids[0]}`, restBody, { board });
        const cliArgs = ['kanban', '--board', board, 'block', ids[0], reason];
        const cliPromise = () => client.cliFallback(cliArgs);
        const data = await tryRestThenCli(restPromise, cliPromise);
        return textResult(data);
      }

      return bulkLifecycle(board, ids, 'blocked', { reason });
    },
  },

  {
    name: 'hb_unblock_task',
    description: 'Unblock one or more kanban tasks (status → ready). Provide task_id for a single task or task_ids for bulk.',
    inputSchema: {
      board: z.string(),
      task_id: z.string().optional(),
      task_ids: z.array(z.string()).optional(),
    },
    async handler(args) {
      const board = String(args.board);
      const ids = resolveTaskIds(args.task_id, args.task_ids);
      if (!ids) return errorResult('Provide task_id or task_ids');

      if (ids.length === 1) {
        const restPromise = () => client.tryRest('PATCH', `/tasks/${ids[0]}`, { status: 'ready' }, { board });
        const cliArgs = ['kanban', '--board', board, 'unblock', ids[0]];
        const cliPromise = () => client.cliFallback(cliArgs);
        const data = await tryRestThenCli(restPromise, cliPromise);
        return textResult(data);
      }

      return bulkLifecycle(board, ids, 'ready');
    },
  },

  {
    name: 'hb_archive_task',
    description: 'Archive one or more kanban tasks (status → archived). Provide task_id for a single task or task_ids for bulk.',
    inputSchema: {
      board: z.string(),
      task_id: z.string().optional(),
      task_ids: z.array(z.string()).optional(),
    },
    async handler(args) {
      const board = String(args.board);
      const ids = resolveTaskIds(args.task_id, args.task_ids);
      if (!ids) return errorResult('Provide task_id or task_ids');

      if (ids.length === 1) {
        const restPromise = () => client.tryRest('PATCH', `/tasks/${ids[0]}`, { status: 'archived' }, { board });
        const cliArgs = ['kanban', '--board', board, 'archive', ids[0]];
        const cliPromise = () => client.cliFallback(cliArgs);
        const data = await tryRestThenCli(restPromise, cliPromise);
        return textResult(data);
      }

      return bulkLifecycle(board, ids, 'archived');
    },
  },

  {
    name: 'hb_assign_task',
    description: 'Assign a kanban task to a profile.',
    inputSchema: {
      board: z.string(),
      task_id: z.string(),
      assignee: z.string().describe('Profile name'),
    },
    async handler(args) {
      const board = String(args.board);
      const taskId = String(args.task_id);
      const assignee = String(args.assignee);

      const restPromise = () => client.tryRest('PATCH', `/tasks/${taskId}`, { assignee }, { board });
      const cliArgs = ['kanban', '--board', board, 'assign', taskId, assignee];
      const cliPromise = () => client.cliFallback(cliArgs);

      const data = await tryRestThenCli(restPromise, cliPromise);
      return textResult(data);
    },
  },

  {
    name: 'hb_add_comment',
    description: 'Add a comment to a kanban task.',
    inputSchema: {
      board: z.string(),
      task_id: z.string(),
      comment: z.string(),
    },
    async handler(args) {
      const board = String(args.board);
      const taskId = String(args.task_id);
      const comment = String(args.comment);

      const restPromise = () => client.tryRest('POST', `/tasks/${taskId}/comments`, { comment }, { board });
      const cliArgs = ['kanban', '--board', board, 'comment', taskId, comment];
      const cliPromise = () => client.cliFallback(cliArgs);

      const data = await tryRestThenCli(restPromise, cliPromise);
      return textResult(data);
    },
  },

  {
    name: 'hb_link_tasks',
    description: 'Link a parent task to a child task.',
    inputSchema: {
      board: z.string().optional(),
      parent_id: z.string(),
      child_id: z.string(),
    },
    async handler(args) {
      const board = args.board ? String(args.board) : undefined;
      const parentId = String(args.parent_id);
      const childId = String(args.child_id);

      const restBody: Record<string, unknown> = { parent_id: parentId, child_id: childId };
      if (board) restBody.board = board;

      const restPromise = () => client.tryRest('POST', '/links', restBody);
      const cliArgs = ['kanban', 'link', parentId, childId, '--json'];
      if (board) cliArgs.splice(1, 0, '--board', board);
      const cliPromise = () => client.cliFallback(cliArgs);

      const data = await tryRestThenCli(restPromise, cliPromise);
      return textResult(data);
    },
  },

  {
    name: 'hb_unlink_tasks',
    description: 'Remove the link between a parent and child task.',
    inputSchema: {
      board: z.string().optional(),
      parent_id: z.string(),
      child_id: z.string(),
    },
    async handler(args) {
      const board = args.board ? String(args.board) : undefined;
      const parentId = String(args.parent_id);
      const childId = String(args.child_id);

      const query: Record<string, string> = { parent_id: parentId, child_id: childId };
      if (board) query.board = board;

      const restPromise = () => client.tryRest('DELETE', '/links', undefined, query);
      const cliArgs = ['kanban', 'unlink', parentId, childId, '--json'];
      if (board) cliArgs.splice(1, 0, '--board', board);
      const cliPromise = () => client.cliFallback(cliArgs);

      const data = await tryRestThenCli(restPromise, cliPromise);
      return textResult(data);
    },
  },

  {
    name: 'hb_specify_task',
    description: 'Run the specify step on a kanban task.',
    inputSchema: {
      board: z.string().optional(),
      task_id: z.string(),
    },
    async handler(args) {
      const board = args.board ? String(args.board) : undefined;
      const taskId = String(args.task_id);

      const restPromise = () => client.tryRest('POST', `/tasks/${taskId}/specify`, undefined, board ? { board } : undefined);
      const cliArgs = ['kanban', 'specify', taskId, '--json'];
      if (board) cliArgs.splice(1, 0, '--board', board);
      const cliPromise = () => client.cliFallback(cliArgs);

      const data = await tryRestThenCli(restPromise, cliPromise);
      return textResult(data);
    },
  },

  {
    name: 'hb_dispatch_tasks',
    description: 'Dispatch workers for ready kanban tasks.',
    inputSchema: {
      board: z.string().optional(),
      max: z.number().int().optional().describe('Maximum tasks to dispatch'),
      dry_run: z.boolean().optional(),
    },
    async handler(args) {
      const board = args.board ? String(args.board) : undefined;
      const max = args.max !== undefined ? Number(args.max) : undefined;
      const dryRun = args.dry_run !== undefined ? Boolean(args.dry_run) : undefined;

      const query: Record<string, string | boolean | undefined> = {};
      if (board) query.board = board;
      if (max !== undefined) query.max = String(max);
      if (dryRun !== undefined) query.dry_run = dryRun;

      const restPromise = () => client.tryRest('POST', '/dispatch', undefined, query);
      const cliArgs = ['kanban', 'dispatch', '--json'];
      if (board) cliArgs.splice(1, 0, '--board', board);
      if (max !== undefined) cliArgs.push('--max', String(max));
      if (dryRun) cliArgs.push('--dry-run');
      const cliPromise = () => client.cliFallback(cliArgs);

      const data = await tryRestThenCli(restPromise, cliPromise);
      return textResult(data);
    },
  },

  {
    name: 'hb_get_runs',
    description: 'List worker runs for a task.',
    inputSchema: {
      board: z.string().optional(),
      task_id: z.string(),
    },
    async handler(args) {
      const board = args.board ? String(args.board) : undefined;
      const taskId = String(args.task_id);
      const query = board ? { board } : undefined;

      const restPromise = () => client.tryRest('GET', `/tasks/${taskId}`, undefined, query);
      const cliArgs = ['kanban', 'runs', taskId, '--json'];
      if (board) cliArgs.splice(1, 0, '--board', board);
      const cliPromise = () => client.cliFallback(cliArgs);

      const data = await tryRestThenCli(restPromise, cliPromise);
      // REST returns full task; extract runs[]
      if (data && typeof data === 'object' && 'runs' in data) {
        return textResult((data as Record<string, unknown>).runs);
      }
      return textResult(data);
    },
  },

  {
    name: 'hb_get_stats',
    description: 'Show kanban board statistics.',
    inputSchema: {
      board: z.string().optional(),
    },
    async handler(args) {
      const board = args.board ? String(args.board) : undefined;
      const query = board ? { board } : undefined;

      const restPromise = () => client.tryRest('GET', '/board', undefined, query);
      const cliArgs = ['kanban', 'stats', '--json'];
      if (board) cliArgs.splice(1, 0, '--board', board);
      const cliPromise = () => client.cliFallback(cliArgs);

      const data = await tryRestThenCli(restPromise, cliPromise);
      return textResult(data);
    },
  },

  {
    name: 'hb_tail_events',
    description: 'Read the most recent events for a task (bounded, one-shot).',
    inputSchema: {
      board: z.string().optional(),
      task_id: z.string(),
      lines: z.number().int().optional().describe('Max lines to return'),
    },
    async handler(args) {
      const board = args.board ? String(args.board) : undefined;
      const taskId = String(args.task_id);
      const lines = args.lines !== undefined ? Number(args.lines) : undefined;

      const query: Record<string, string | number | undefined> = {};
      if (board) query.board = board;
      if (lines !== undefined) query.lines = lines;

      const restPromise = () => client.tryRest('GET', `/tasks/${taskId}`, undefined, query);
      const cliArgs = ['kanban', 'tail', taskId, '--json'];
      if (board) cliArgs.splice(1, 0, '--board', board);
      if (lines !== undefined) cliArgs.push('--lines', String(lines));
      const cliPromise = () => client.cliFallback(cliArgs);

      const data = await tryRestThenCli(restPromise, cliPromise);
      return textResult(data);
    },
  },

  {
    name: 'hb_send_heartbeat',
    description: 'Send a liveness heartbeat for a long-running task. Workers should call this every few minutes during long operations.',
    inputSchema: {
      board: z.string(),
      task_id: z.string(),
      note: z.string().optional().describe('Optional progress note'),
    },
    async handler(args) {
      const board = String(args.board);
      const taskId = String(args.task_id);
      const note = args.note ? String(args.note) : undefined;

      const cliArgs = ['kanban', '--board', board, 'heartbeat', taskId, '--json'];
      if (note) cliArgs.push('--note', note);
      const data = await client.cliFallback(cliArgs);
      return textResult(data);
    },
  },

  // ── Task mutation ────────────────────────────────────────────────
  {
    name: 'hb_edit_task',
    description: 'Edit fields on an existing kanban task (title, body, priority, result). At least one field must be provided.',
    inputSchema: {
      board: z.string().optional(),
      task_id: z.string(),
      title: z.string().optional(),
      body: z.string().optional(),
      priority: z.number().int().optional(),
      result: z.string().optional(),
    },
    async handler(args) {
      const board = args.board ? String(args.board) : undefined;
      const taskId = String(args.task_id);
      const patch: Record<string, unknown> = {};
      if (args.title !== undefined) patch.title = String(args.title);
      if (args.body !== undefined) patch.body = String(args.body);
      if (args.priority !== undefined) patch.priority = Number(args.priority);
      if (args.result !== undefined) patch.result = String(args.result);

      if (Object.keys(patch).length === 0) {
        return errorResult('At least one field to update must be provided');
      }

      const restPromise = () => client.tryRest('PATCH', `/tasks/${taskId}`, patch, board ? { board } : undefined);
      const cliArgs = ['kanban', 'show', taskId, '--json'];
      if (board) cliArgs.splice(1, 0, '--board', board);
      const cliPromise = () => client.cliFallback(cliArgs);

      const data = await tryRestThenCli(restPromise, cliPromise);
      return textResult(data);
    },
  },

  // ── Task claim ──────────────────────────────────────────────────
  {
    name: 'hb_claim_task',
    description: 'Atomically claim a ready task. Returns the resolved workspace path.',
    inputSchema: {
      board: z.string().optional(),
      task_id: z.string(),
      ttl: z.number().int().optional().describe('Time-to-live in seconds for the claim'),
    },
    async handler(args) {
      const board = args.board ? String(args.board) : undefined;
      const taskId = String(args.task_id);
      const cliArgs = ['kanban', 'claim', taskId, '--json'];
      if (board) cliArgs.splice(1, 0, '--board', board);
      if (args.ttl !== undefined) cliArgs.push('--ttl', String(args.ttl));
      const data = await client.cliFallback(cliArgs);
      return textResult(data);
    },
  },

  // ── Task context & logs ─────────────────────────────────────────
  {
    name: 'hb_task_log',
    description: 'Read the worker log file for a task.',
    inputSchema: {
      board: z.string().optional(),
      task_id: z.string(),
      tail: z.number().int().optional().describe('Bytes to read from end of log'),
    },
    async handler(args) {
      const board = args.board ? String(args.board) : undefined;
      const taskId = String(args.task_id);
      const cliArgs = ['kanban', 'log', taskId];
      if (board) cliArgs.splice(1, 0, '--board', board);
      if (args.tail !== undefined) cliArgs.push('--tail', String(args.tail));
      const data = await client.cliFallback(cliArgs);
      return textResult(data);
    },
  },

  {
    name: 'hb_task_context',
    description: 'Return the full context a worker would see (title, body, parent results, comments).',
    inputSchema: {
      board: z.string().optional(),
      task_id: z.string(),
    },
    async handler(args) {
      const board = args.board ? String(args.board) : undefined;
      const taskId = String(args.task_id);
      const cliArgs = ['kanban', 'context', taskId];
      if (board) cliArgs.splice(1, 0, '--board', board);
      const data = await client.cliFallback(cliArgs);
      return textResult(data);
    },
  },

  // ── Board lifecycle ─────────────────────────────────────────────
  {
    name: 'hb_init',
    description: 'Initialize kanban.db if missing. Idempotent.',
    inputSchema: {},
    async handler() {
      const data = await client.cliFallback(['kanban', 'init', '--json']);
      return textResult(data);
    },
  },

  {
    name: 'hb_boards_switch',
    description: 'Persist a board as the active default.',
    inputSchema: {
      board: z.string().describe('Board slug to make active'),
    },
    async handler(args) {
      const board = String(args.board);
      const data = await client.cliFallback(['kanban', 'boards', 'switch', board]);
      return textResult(data);
    },
  },

  {
    name: 'hb_boards_show',
    description: 'Show the currently-active board metadata (slug, name, path, task counts).',
    inputSchema: {},
    async handler() {
      const data = await client.cliFallback(['kanban', 'boards', 'show', '--json']);
      return textResult(data);
    },
  },

  {
    name: 'hb_boards_rename',
    description: 'Change a board display name. The slug is immutable.',
    inputSchema: {
      board: z.string().describe('Board slug'),
      name: z.string().describe('New display name'),
    },
    async handler(args) {
      const board = String(args.board);
      const name = String(args.name);
      const data = await client.cliFallback(['kanban', 'boards', 'rename', board, name]);
      return textResult(data);
    },
  },

  {
    name: 'hb_boards_rm',
    description: 'Archive or hard-delete a non-default board.',
    inputSchema: {
      board: z.string().describe('Board slug to remove'),
      delete_permanently: z.boolean().optional().describe('Hard-delete instead of archive'),
    },
    async handler(args) {
      const board = String(args.board);
      if (board === 'default') {
        return errorResult('Cannot remove the default board');
      }
      const cliArgs = ['kanban', 'boards', 'rm', board];
      if (args.delete_permanently) cliArgs.push('--delete');
      const data = await client.cliFallback(cliArgs);
      return textResult(data);
    },
  },

  // ── Board observability ─────────────────────────────────────────
  {
    name: 'hb_watch_events',
    description: 'Return a bounded snapshot of recent board events.',
    inputSchema: {
      board: z.string().optional(),
      assignee: z.string().optional(),
      tenant: z.string().optional(),
      kinds: z.string().optional().describe('Comma-separated event kinds filter (e.g. "completed,blocked")'),
      limit: z.number().int().optional().describe('Max events to return'),
    },
    async handler(args) {
      const board = args.board ? String(args.board) : undefined;
      const cliArgs = ['kanban', 'watch', '--json'];
      if (board) cliArgs.splice(1, 0, '--board', board);
      if (args.assignee) cliArgs.push('--assignee', String(args.assignee));
      if (args.tenant) cliArgs.push('--tenant', String(args.tenant));
      if (args.kinds) cliArgs.push('--kinds', String(args.kinds));
      if (args.limit !== undefined) cliArgs.push('--limit', String(args.limit));
      const data = await client.cliFallback(cliArgs);
      return textResult(data);
    },
  },

  {
    name: 'hb_list_assignees',
    description: 'List profiles on disk with per-assignee task counts.',
    inputSchema: {
      board: z.string().optional(),
    },
    async handler(args) {
      const board = args.board ? String(args.board) : undefined;
      const cliArgs = ['kanban', 'assignees', '--json'];
      if (board) cliArgs.splice(1, 0, '--board', board);
      const data = await client.cliFallback(cliArgs);
      return textResult(data);
    },
  },

  // ── Board maintenance ───────────────────────────────────────────
  {
    name: 'hb_gc',
    description: 'Garbage-collect scratch workspaces for archived tasks and optionally prune old events and logs.',
    inputSchema: {
      board: z.string().optional(),
      event_retention_days: z.number().int().optional(),
      log_retention_days: z.number().int().optional(),
    },
    async handler(args) {
      const board = args.board ? String(args.board) : undefined;
      const cliArgs = ['kanban', 'gc', '--json'];
      if (board) cliArgs.splice(1, 0, '--board', board);
      if (args.event_retention_days !== undefined) cliArgs.push('--event-retention-days', String(args.event_retention_days));
      if (args.log_retention_days !== undefined) cliArgs.push('--log-retention-days', String(args.log_retention_days));
      const data = await client.cliFallback(cliArgs);
      return textResult(data);
    },
  },

  // ── Notification subscriptions ──────────────────────────────────
  {
    name: 'hb_notify_subscribe',
    description: 'Subscribe a chat to a task\'s terminal events (completed, blocked, gave_up, crashed, timed_out).',
    inputSchema: {
      task_id: z.string(),
      platform: z.string().describe('Messaging platform (telegram, slack, discord, etc.)'),
      chat_id: z.string(),
      thread_id: z.string().optional(),
      user_id: z.string().optional(),
    },
    async handler(args) {
      const taskId = String(args.task_id);
      const cliArgs = ['kanban', 'notify-subscribe', taskId,
        '--platform', String(args.platform),
        '--chat-id', String(args.chat_id)];
      if (args.thread_id) cliArgs.push('--thread-id', String(args.thread_id));
      if (args.user_id) cliArgs.push('--user-id', String(args.user_id));
      const data = await client.cliFallback(cliArgs);
      return textResult(data);
    },
  },

  {
    name: 'hb_notify_list',
    description: 'List active notification subscriptions, optionally filtered to a specific task.',
    inputSchema: {
      task_id: z.string().optional(),
    },
    async handler(args) {
      const cliArgs = ['kanban', 'notify-list', '--json'];
      if (args.task_id) cliArgs.splice(2, 0, String(args.task_id));
      const data = await client.cliFallback(cliArgs);
      return textResult(data);
    },
  },

  {
    name: 'hb_notify_unsubscribe',
    description: 'Remove a notification subscription from a task.',
    inputSchema: {
      task_id: z.string(),
      platform: z.string(),
      chat_id: z.string(),
      thread_id: z.string().optional(),
    },
    async handler(args) {
      const taskId = String(args.task_id);
      const cliArgs = ['kanban', 'notify-unsubscribe', taskId,
        '--platform', String(args.platform),
        '--chat-id', String(args.chat_id)];
      if (args.thread_id) cliArgs.push('--thread-id', String(args.thread_id));
      const data = await client.cliFallback(cliArgs);
      return textResult(data);
    },
  },

  // ── Generic spec import ─────────────────────────────────────────
  {
    name: 'hb_import_spec',
    description: 'Create a kanban task from any spec provider. The provider is selected by the spec_ref prefix (e.g. "openspec:change-name", "speckit:feature/42"). The worker receives full Git context and derives spec_path from spec_ref.',
    inputSchema: {
      spec_ref: z.string().describe('Spec reference with provider prefix, e.g. "openspec:add-dark-mode"'),
      base_commit: z.string().describe('Full Git commit hash required for worker checkout').refine(
        (v) => /^[0-9a-f]{7,40}$/i.test(v),
        { message: 'base_commit must be a 7-40 character hex string' }
      ),
      board: z.string().optional().describe('Target board slug; optional if project or repo resolves a board'),
      project: z.string().optional().describe('Project slug for routing'),
      repo: z.string().optional().describe('Repo URL or alias for routing'),
      base_branch: z.string().optional().describe('Git branch name (defaults to project default_branch)'),
      assignee: z.string().optional(),
      workspace: z.union([z.literal('scratch'), z.literal('worktree'), z.string().regex(/^dir:/)]).optional(),
      skills: z.array(z.string()).optional(),
      allowed_paths: z.array(z.string()).optional().describe('Paths the worker is allowed to modify'),
    },
    async handler(args) {
      const specRef = String(args.spec_ref);
      const baseCommit = String(args.base_commit);

      // Resolve board from project or repo
      let board: string | undefined = args.board ? String(args.board) : undefined;
      let projectSlug: string | undefined = args.project ? String(args.project) : undefined;
      let repoUrl: string | undefined;
      let defaultBranch = 'main';

      if (!board) {
        if (projectSlug) {
          const meta = resolveProject(projectSlug);
          if (!meta) return errorResult(`Project "${projectSlug}" not found`);
          board = meta.board;
          repoUrl = meta.repo_url;
          defaultBranch = meta.default_branch;
        } else if (args.repo) {
          const repoStr = String(args.repo);
          const meta = resolveProjectByRepo(repoStr);
          if (!meta) return errorResult(`No project matches repo "${repoStr}"`);
          board = meta.board;
          projectSlug = meta.board;
          repoUrl = meta.repo_url;
          defaultBranch = meta.default_branch;
        } else {
          return errorResult('Missing board: provide board, project, or repo');
        }
      }

      if (!board) return errorResult('Board could not be resolved');

      // If still no repoUrl, try to get it from the resolved project
      if (!repoUrl && projectSlug) {
        const meta = resolveProject(projectSlug);
        if (meta) repoUrl = meta.repo_url;
      }
      if (!repoUrl && args.repo) {
        repoUrl = String(args.repo);
      }
      if (!repoUrl) return errorResult('Could not determine repo_url for the project');

      const baseBranch = args.base_branch ? String(args.base_branch) : defaultBranch;

      // Resolve the spec provider and build the body
      let specBody: string;
      try {
        const provider = resolveProvider(specRef);
        specBody = provider.buildBody(specRef, { repoUrl, baseBranch, baseCommit });
      } catch (err) {
        return errorResult((err as Error).message);
      }

      // Append optional allowed_paths
      const allowedPaths = Array.isArray(args.allowed_paths) ? args.allowed_paths.map(String) : undefined;
      if (allowedPaths && allowedPaths.length) {
        specBody += `\nallowed_paths: ${allowedPaths.join(', ')}`;
      }

      const projectPrefix = projectSlug || board;
      const idempotencyKey = `${projectPrefix}:${specRef}:${baseCommit}`;

      const workspaceVal = args.workspace ? String(args.workspace) : 'scratch';

      const changeName = specRef.includes(':') ? specRef.split(':').slice(1).join(':') : specRef;
      const title = `[spec] ${changeName}`;

      return kanbanCreateCore({
        board,
        title,
        body: specBody,
        idempotency_key: idempotencyKey,
        assignee: args.assignee ? String(args.assignee) : undefined,
        workspace: workspaceVal,
        skills: Array.isArray(args.skills) ? args.skills.map(String) : undefined,
      });
    },
  },

];
