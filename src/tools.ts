/**
 * MCP tool definitions for hermes-board-mcp v2.
 *
 * All kanban tools mirror Hermes's worker CLI surface.
 * Hybrid transport: HermesKanbanClient tries REST first, falls back to CLI.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { z } from 'zod';
import { runCommand } from './command-runner.js';
import { resolveProject, resolveProjectByRepo, resolveOpenspecRoot } from './project.js';
import { HermesKanbanClient } from './hermes-client.js';

const client = new HermesKanbanClient();

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
  } catch {
    return await cliCall() as T;
  }
}

function isValidStatus(s: string | undefined): s is typeof VALID_STATUSES[number] {
  if (!s) return false;
  return VALID_STATUSES.includes(s as typeof VALID_STATUSES[number]);
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

// ── Core kanban_create (shared by kanban_create and kanban_create_from_openspec) ──
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
    name: 'kanban_boards_list',
    description: 'List all kanban boards.',
    inputSchema: {},
    async handler() {
      const result = await client.cliFallback(['kanban', 'boards', 'list', '--json']);
      return textResult(result);
    },
  },

  {
    name: 'kanban_create_board',
    description: 'Create a new kanban board.',
    inputSchema: {
      board: z.string().describe('Slug for the new board'),
      description: z.string().optional().describe('Optional board description'),
    },
    async handler(args) {
      const board = String(args.board);
      const cmdArgs = ['kanban', 'boards', 'create', board, '--json'];
      if (args.description) cmdArgs.push('--description', String(args.description));
      const result = await client.cliFallback(cmdArgs);
      return textResult(result);
    },
  },

  // ── Task-level reads ────────────────────────────────────────────
  {
    name: 'kanban_list',
    description: 'List tasks on a kanban board, optionally filtered by status or metadata.',
    inputSchema: {
      board: z.string().describe('Board slug'),
      status: z.enum(VALID_STATUSES).optional().describe('Filter by status'),
      tenant: z.string().optional(),
      include_archived: z.boolean().optional(),
    },
    async handler(args) {
      const board = String(args.board);
      const query: Record<string, string | boolean | undefined> = { board };
      if (args.status) query.status = String(args.status);
      if (args.tenant) query.tenant = String(args.tenant);
      if (args.include_archived !== undefined) query.include_archived = Boolean(args.include_archived);

      const restPromise = () => client.tryRest('GET', '/board', undefined, query);
      const cliArgs = ['kanban', '--board', board, 'list', '--json'];
      if (args.status) cliArgs.push('--status', String(args.status));
      if (args.tenant) cliArgs.push('--tenant', String(args.tenant));
      const cliPromise = () => client.cliFallback(cliArgs);

      const result = await tryRestThenCli(restPromise, cliPromise);
      // Enrich with project metadata
      if (Array.isArray(result)) {
        const enriched = (result as Array<Record<string, unknown>>).map(r => ({
          ...r,
          ...(resolveProject(String(r.slug || r.board)) || {}),
        }));
        return textResult(enriched);
      }
      return textResult(result);
    },
  },

  {
    name: 'kanban_show',
    description: 'Show full details of a single kanban task.',
    inputSchema: {
      board: z.string().optional(),
      task_id: z.string().describe('Task ID'),
    },
    async handler(args) {
      const board = args.board ? String(args.board) : undefined;
      const taskId = String(args.task_id);
      const query = board ? { board } : undefined;

      const restPromise = () => client.tryRest('GET', `/tasks/${taskId}`, undefined, query);
      const cliArgs = ['kanban', '--board', board || '_', 'show', taskId, '--json'];
      const cliPromise = () => client.cliFallback(cliArgs);

      const result = await tryRestThenCli(restPromise, cliPromise);
      return textResult(result);
    },
  },

  // ── Task creation ────────────────────────────────────────────────
  {
    name: 'kanban_create',
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
    name: 'kanban_complete',
    description: 'Complete a kanban task (status → done).',
    inputSchema: {
      board: z.string(),
      task_id: z.string(),
      summary: z.string().optional(),
      result: z.string().optional(),
    },
    async handler(args) {
      const board = String(args.board);
      const taskId = String(args.task_id);
      const summary = args.summary ? String(args.summary) : undefined;
      const result = args.result ? String(args.result) : undefined;

      const restBody: Record<string, unknown> = { status: 'done' };
      if (summary) restBody.summary = summary;
      if (result) restBody.result = result;

      const restPromise = () => client.tryRest('PATCH', `/tasks/${taskId}`, restBody, { board });
      const cliArgs = ['kanban', '--board', board, 'complete', taskId, '--json'];
      if (summary) cliArgs.push('--summary', summary);
      if (result) cliArgs.push('--result', result);
      const cliPromise = () => client.cliFallback(cliArgs);

      const data = await tryRestThenCli(restPromise, cliPromise);
      return textResult(data);
    },
  },

  {
    name: 'kanban_block',
    description: 'Block a kanban task (status → blocked).',
    inputSchema: {
      board: z.string(),
      task_id: z.string(),
      reason: z.string().describe('Blocking reason'),
    },
    async handler(args) {
      const board = String(args.board);
      const taskId = String(args.task_id);
      const reason = String(args.reason);

      const restBody = { status: 'blocked', reason };

      const restPromise = () => client.tryRest('PATCH', `/tasks/${taskId}`, restBody, { board });
      const cliArgs = ['kanban', '--board', board, 'block', taskId, reason, '--json'];
      const cliPromise = () => client.cliFallback(cliArgs);

      const data = await tryRestThenCli(restPromise, cliPromise);
      return textResult(data);
    },
  },

  {
    name: 'kanban_unblock',
    description: 'Unblock a kanban task (status → ready).',
    inputSchema: {
      board: z.string(),
      task_id: z.string(),
    },
    async handler(args) {
      const board = String(args.board);
      const taskId = String(args.task_id);

      const restPromise = () => client.tryRest('PATCH', `/tasks/${taskId}`, { status: 'ready' }, { board });
      const cliArgs = ['kanban', '--board', board, 'unblock', taskId, '--json'];
      const cliPromise = () => client.cliFallback(cliArgs);

      const data = await tryRestThenCli(restPromise, cliPromise);
      return textResult(data);
    },
  },

  {
    name: 'kanban_archive',
    description: 'Archive a kanban task (status → archived).',
    inputSchema: {
      board: z.string(),
      task_id: z.string(),
    },
    async handler(args) {
      const board = String(args.board);
      const taskId = String(args.task_id);

      const restPromise = () => client.tryRest('PATCH', `/tasks/${taskId}`, { status: 'archived' }, { board });
      const cliArgs = ['kanban', '--board', board, 'archive', taskId, '--json'];
      const cliPromise = () => client.cliFallback(cliArgs);

      const data = await tryRestThenCli(restPromise, cliPromise);
      return textResult(data);
    },
  },

  {
    name: 'kanban_assign',
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
      const cliArgs = ['kanban', '--board', board, 'assign', taskId, assignee, '--json'];
      const cliPromise = () => client.cliFallback(cliArgs);

      const data = await tryRestThenCli(restPromise, cliPromise);
      return textResult(data);
    },
  },

  {
    name: 'kanban_comment',
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
      const cliArgs = ['kanban', '--board', board, 'comment', taskId, comment, '--json'];
      const cliPromise = () => client.cliFallback(cliArgs);

      const data = await tryRestThenCli(restPromise, cliPromise);
      return textResult(data);
    },
  },

  {
    name: 'kanban_link',
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
    name: 'kanban_unlink',
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
    name: 'kanban_specify',
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
    name: 'kanban_dispatch',
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
    name: 'kanban_runs',
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
    name: 'kanban_stats',
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
    name: 'kanban_tail',
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
    name: 'kanban_heartbeat',
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

  // ── OpenSpec import ──────────────────────────────────────────────
  {
    name: 'kanban_create_from_openspec',
    description: 'Read an OpenSpec change and create kanban tasks using portable Git context. Requires base_commit. Defaults workspace to scratch. Derives idempotency keys from project:change:commit:index.',
    inputSchema: {
      board: z.string().optional().describe('Target board slug; optional if project or repo resolves a board'),
      change_name: z.string().describe('OpenSpec change name'),
      project: z.string().optional().describe('Project slug for routing'),
      repo: z.string().optional().describe('Repo URL or alias for routing'),
      base_commit: z.string().describe('Full Git commit hash required for worker checkout'),
      base_branch: z.string().optional().describe('Git branch name (defaults to project default_branch)'),
      spec_ref: z.string().optional().describe('Spec reference, e.g. git ref or tag'),
      spec_path: z.string().optional().describe('Path within repo to the spec directory'),
      test_command: z.string().optional().describe('Command to run tests for this spec'),
      dependency_strategy: z.enum(['none', 'sequential', 'explicit']).optional().describe('none=parallel, sequential=chain, explicit=read from OpenSpec metadata'),
      assignee: z.string().optional(),
      workspace: z.union([z.literal('scratch'), z.literal('worktree'), z.string().regex(/^dir:/)]).optional(),
      skills: z.array(z.string()).optional(),
      allowed_paths: z.array(z.string()).optional().describe('Paths the worker is allowed to modify'),
    },
    async handler(args) {
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
          projectSlug = meta.board; // canonicalize
          repoUrl = meta.repo_url;
          defaultBranch = meta.default_branch;
        } else {
          return errorResult('Missing board: provide board, project, or repo');
        }
      }

      if (!board) return errorResult('Board could not be resolved');

      const changeName = String(args.change_name);
      const baseCommit = String(args.base_commit);
      const baseBranch = args.base_branch ? String(args.base_branch) : defaultBranch;
      const depStrategy = (args.dependency_strategy as 'none' | 'sequential' | 'explicit' | undefined) ?? 'none';

      // If still no repoUrl, try to get it from the resolved project
      if (!repoUrl && projectSlug) {
        const meta = resolveProject(projectSlug);
        if (meta) repoUrl = meta.repo_url;
      }

      const openspecRoot = resolveOpenspecRoot(projectSlug);
      const changeDir = join(openspecRoot, 'changes', changeName);

      if (!existsSync(changeDir)) {
        return errorResult(`Change "${changeName}" not found at ${changeDir}`);
      }

      // Try canonical task list from openspec CLI first
      let tasks: Array<Record<string, string>> = [];
      let usedInstructions = false;
      try {
        const { stdout } = await runCommand('openspec', ['instructions', 'apply', '--change', changeName, '--json'], { cwd: openspecRoot });
        const parsed = parseJsonSafe(stdout) as unknown;
        if (parsed && typeof parsed === 'object' && 'tasks' in parsed && Array.isArray((parsed as Record<string, unknown>).tasks)) {
          tasks = (parsed as Record<string, unknown>).tasks as Array<Record<string, string>>;
          usedInstructions = true;
        }
      } catch {
        // Fall through to tasks.md parsing
      }

      if (!tasks.length) {
        // Fall back to parsing tasks.md
        const tasksPath = join(changeDir, 'tasks.md');
        if (!existsSync(tasksPath)) {
          return errorResult(`No tasks found for change "${changeName}" (no tasks.md and no CLI instructions)`);
        }
        const content = readFileSync(tasksPath, 'utf8');
        const lines = content.split('\n');
        let currentTitle: string | null = null;
        let currentBody: string[] = [];

        for (const line of lines) {
          const headingMatch = line.match(/^#{1,3}\s+(.+)/);
          const checkboxMatch = line.match(/^-\s+\[[ x]\]\s+(.+)/);

          if (headingMatch || checkboxMatch) {
            if (currentTitle) {
              tasks.push({ title: currentTitle, body: currentBody.join('\n').trim() });
            }
            currentTitle = headingMatch ? headingMatch[1] : checkboxMatch![1];
            currentBody = [];
          } else if (currentTitle) {
            currentBody.push(line);
          }
        }
        if (currentTitle) {
          tasks.push({ title: currentTitle, body: currentBody.join('\n').trim() });
        }
      }

      if (!tasks.length) return errorResult('No tasks found in change');

      const projectPrefix = projectSlug || board;
      const createdIds: Array<unknown> = [];

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        // v3 idempotency key: project:change:commit:index
        const idempotencyKey = `${projectPrefix}:${changeName}:${baseCommit}:${i}`;

        let parents: string[] | undefined;
        if (depStrategy === 'sequential' && i > 0) {
          parents = [String(createdIds[i - 1])];
        } else if (depStrategy === 'explicit' && usedInstructions && task.dependencies) {
          parents = String(task.dependencies).split(',').map(s => s.trim());
        } else if (depStrategy === 'explicit' && !usedInstructions) {
          return errorResult('dependency_strategy=explicit requires OpenSpec instructions JSON with dependency metadata; fallback tasks.md does not support explicit dependencies');
        }

        // Build portable context block for worker
        const specRef = args.spec_ref ? String(args.spec_ref) : undefined;
        const specPath = args.spec_path ? String(args.spec_path) : undefined;
        const testCommand = args.test_command ? String(args.test_command) : undefined;
        const allowedPaths = Array.isArray(args.allowed_paths) ? args.allowed_paths.map(String) : undefined;
        const workspaceVal = args.workspace ? String(args.workspace) : 'scratch';

        const metaBlock = formatOpenSpecBlock({
          spec_ref: specRef,
          test_command: testCommand,
        });

        let fullBody = task.body || '';
        if (repoUrl) {
          const checkoutInstructions = [
            '## Worker Context',
            `- **repo_url**: ${repoUrl}`,
            `- **base_branch**: ${baseBranch}`,
            `- **base_commit**: ${baseCommit}`,
            specPath ? `- **spec_path**: ${specPath}` : '',
            testCommand ? `- **test_command**: ${testCommand}` : '',
            allowedPaths ? `- **allowed_paths**: ${allowedPaths.join(', ')}` : '',
            '',
            '## Checkout Instructions',
            `Clone or fetch \`${repoUrl}\` inside \`$HERMES_KANBAN_WORKSPACE\` and checkout \`${baseCommit}\`.`,
            specPath ? `Then read the spec at \`${specPath}\`.` : '',
          ].filter(Boolean).join('\n');
          fullBody = fullBody ? `${fullBody}\n\n${checkoutInstructions}` : checkoutInstructions;
        }
        if (metaBlock) {
          fullBody = fullBody ? `${fullBody}\n\n${metaBlock}` : metaBlock;
        }

        const createArgs: KanbanCreateArgs = {
          board,
          title: task.title,
          body: fullBody,
          idempotency_key: idempotencyKey,
          assignee: args.assignee ? String(args.assignee) : undefined,
          workspace: workspaceVal,
          skills: Array.isArray(args.skills) ? args.skills.map(String) : undefined,
          parents,
        };

        try {
          const result = await kanbanCreateCore(createArgs);
          const text = (result.content[0] as { text: string }).text;
          const parsed = parseJsonSafe(text) as Record<string, unknown>;
          createdIds.push(parsed.id ?? parsed);
        } catch (err) {
          createdIds.push({ error: (err as Error).message, title: task.title });
        }
      }

      return textResult({ created: createdIds.length, ids: createdIds });
    },
  },

  // ── OpenSpec tools ────────────────────────────────────────────────
  {
    name: 'openspec_validate',
    description: 'Validate an OpenSpec change.',
    inputSchema: {
      change_name: z.string(),
      project: z.string().optional(),
    },
    async handler(args) {
      const cwd = resolveOpenspecRoot(args.project ? String(args.project) : undefined);
      const changeName = String(args.change_name);
      const { stdout } = await runCommand('openspec', [
        'validate', changeName, '--json', '--no-interactive',
      ], { cwd });
      return textResult(parseJsonSafe(stdout));
    },
  },

  {
    name: 'openspec_status',
    description: 'Get status of an OpenSpec change.',
    inputSchema: {
      change_name: z.string(),
      project: z.string().optional(),
    },
    async handler(args) {
      const cwd = resolveOpenspecRoot(args.project ? String(args.project) : undefined);
      const changeName = String(args.change_name);
      const { stdout } = await runCommand('openspec', [
        'status', '--change', changeName, '--json',
      ], { cwd });
      return textResult(parseJsonSafe(stdout));
    },
  },

  {
    name: 'openspec_list',
    description: 'List all OpenSpec changes for a project.',
    inputSchema: {
      project: z.string().optional(),
    },
    async handler(args) {
      const cwd = resolveOpenspecRoot(args.project ? String(args.project) : undefined);
      const { stdout } = await runCommand('openspec', ['list', '--json'], { cwd });
      return textResult(parseJsonSafe(stdout));
    },
  },

  {
    name: 'openspec_push',
    description: 'Upload OpenSpec change artifacts and auto-validate.',
    inputSchema: {
      project: z.string(),
      change_name: z.string(),
      artifacts: z.record(z.string()).describe('Map of relative path → file content'),
    },
    async handler(args) {
      const projectSlug = String(args.project);
      const changeName = String(args.change_name);
      const artifacts = args.artifacts as Record<string, string>;
      const project = resolveProject(projectSlug);
      if (!project?.openspec_root) {
        return errorResult(`Project "${projectSlug}" is not onboarded or has no openspec_root`);
      }

      const changeDir = join(project.openspec_root, 'changes', changeName);
      const written: string[] = [];

      for (const [relPath, content] of Object.entries(artifacts)) {
        if (relPath.includes('..') || relPath.startsWith('/')) {
          return errorResult(`Invalid path: ${relPath}`);
        }
        const fullPath = join(changeDir, relPath);
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, content, 'utf8');
        written.push(relPath);
      }

      let validation: unknown;
      try {
        const { stdout } = await runCommand('openspec', [
          'validate', changeName, '--json', '--no-interactive',
        ], { cwd: project.openspec_root });
        validation = parseJsonSafe(stdout);
      } catch (err) {
        validation = { error: (err as Error).message };
      }

      return textResult({ written, validation });
    },
  },
];
