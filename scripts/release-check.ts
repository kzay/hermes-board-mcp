import { spawnSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { fileURLToPath } from 'url';

export const CANONICAL_CLIENT_SKILLS = [
  'hb-deploy',
  'hb-monitor',
  'hb-plan',
  'hb-worker',
  'hb-release',
] as const;

const STALE_CLIENT_SKILLS = ['openspec-deploy', 'openspec-monitor'] as const;
const STALE_PATTERNS = ['hb_import_openspec', 'kanban_', ...STALE_CLIENT_SKILLS] as const;

const SCAN_ROOTS = [
  'README.md',
  'AGENTS.md',
  'CLAUDE.md',
  'client',
  'openspec/specs',
] as const;

const SKIP_DIRS = new Set([
  '.git',
  'dist',
  'node_modules',
  'tmp',
  'openspec/changes',
  'openspec/changes/archive',
]);

const TEXT_EXTENSIONS = new Set([
  '.json',
  '.js',
  '.md',
  '.ts',
  '.txt',
  '.yaml',
  '.yml',
]);

export interface StaleReference {
  relativePath: string;
  line: number;
  pattern: string;
  text: string;
}

function normalizePath(path: string): string {
  return path.split(sep).join('/');
}

function extensionOf(path: string): string {
  const idx = path.lastIndexOf('.');
  return idx === -1 ? '' : path.slice(idx);
}

function shouldSkip(relativePath: string): boolean {
  const normalized = normalizePath(relativePath);
  if (normalized === 'CHANGELOG.md') return true;
  for (const dir of SKIP_DIRS) {
    if (normalized === dir || normalized.startsWith(`${dir}/`)) return true;
  }
  return false;
}

function collectTextFiles(root: string, current: string, files: string[]): void {
  const rel = normalizePath(relative(root, current));
  if (rel && shouldSkip(rel)) return;

  const stat = statSync(current);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(current)) {
      collectTextFiles(root, join(current, entry), files);
    }
    return;
  }

  if (TEXT_EXTENSIONS.has(extensionOf(current))) files.push(current);
}

export function parseNpmPackFiles(output: string): string[] {
  const files: string[] = [];

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^npm notice\s+\S+\s+(.+)$/);
    if (!match) continue;

    const path = match[1].trim().replace(/\\/g, '/');
    if (!path || path === 'Contents' || path === 'Details') continue;
    if (path.includes(':')) continue;
    files.push(path);
  }

  return files;
}

export function validateClientPackFiles(files: string[]): string[] {
  const normalized = new Set(files.map(f => f.replace(/\\/g, '/')));
  const errors: string[] = [];

  for (const skill of CANONICAL_CLIENT_SKILLS) {
    const expected = `skills/${skill}/SKILL.md`;
    if (!normalized.has(expected)) errors.push(`Missing client skill: ${expected}`);
  }

  for (const skill of STALE_CLIENT_SKILLS) {
    const stalePath = `skills/${skill}/SKILL.md`;
    if (normalized.has(stalePath)) errors.push(`Stale client skill must not ship: ${stalePath}`);
  }

  return errors;
}

export function findStaleReferences(root: string): StaleReference[] {
  const files: string[] = [];

  for (const entry of SCAN_ROOTS) {
    const fullPath = join(root, entry);
    if (!existsSync(fullPath)) continue;
    collectTextFiles(root, fullPath, files);
  }

  const findings: StaleReference[] = [];

  for (const file of files) {
    const relativePath = normalizePath(relative(root, file));
    if (shouldSkip(relativePath)) continue;

    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((text, index) => {
      for (const pattern of STALE_PATTERNS) {
        if (text.includes(pattern)) {
          findings.push({
            relativePath,
            line: index + 1,
            pattern,
            text: text.trim(),
          });
        }
      }
    });
  }

  return findings;
}

function runClientPackCheck(root: string): string[] {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const args = process.platform === 'win32'
    ? ['/c', 'npm', 'pack', '--dry-run']
    : ['pack', '--dry-run'];
  const result = spawnSync(command, args, {
    cwd: join(root, 'client'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.status !== 0) {
    return [`npm pack --dry-run failed: ${output.trim() || result.error?.message || 'unknown error'}`];
  }

  return validateClientPackFiles(parseNpmPackFiles(output));
}

export function runReleaseChecks(root: string): string[] {
  const errors: string[] = [];

  const staleFindings = findStaleReferences(root);
  for (const finding of staleFindings) {
    errors.push(
      `Stale reference ${finding.pattern} in ${finding.relativePath}:${finding.line}: ${finding.text}`
    );
  }

  errors.push(...runClientPackCheck(root));
  return errors;
}

function repoRootFromScript(): string {
  return fileURLToPath(new URL('../..', import.meta.url));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = process.argv[2] || repoRootFromScript();
  const errors = runReleaseChecks(root);

  if (errors.length) {
    console.error('[release-check] failed');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log('[release-check] ok');
}
