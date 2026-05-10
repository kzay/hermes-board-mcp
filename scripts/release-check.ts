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

const REQUIRED_CLIENT_PACKAGE_FILES = [
  'CHANGELOG.md',
  'LICENSE',
  'skills/hb-deploy/references/providers/openspec.md',
  'skills/evals/routing.json',
] as const;

const REQUIRED_ROOT_PACKAGE_FILES = [
  'AGENTS.md',
  'CHANGELOG.md',
  'CLAUDE.md',
  'LICENSE',
  'README.md',
  'hermes-board-mcp.service',
  'policy.yaml',
] as const;

const ACTIVE_RELEASE_DOCS = [
  'README.md',
  'AGENTS.md',
  'CLAUDE.md',
  'policy.yaml',
  'client/README.md',
  'client/AGENTS.md',
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

interface RoutingEvalCase {
  name?: unknown;
  user_request?: unknown;
  expected_skill?: unknown;
  should_not_load?: unknown;
  expected_provider_reference?: unknown;
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

  for (const expected of REQUIRED_CLIENT_PACKAGE_FILES) {
    if (!normalized.has(expected)) errors.push(`Missing client package file: ${expected}`);
  }

  for (const skill of STALE_CLIENT_SKILLS) {
    const stalePath = `skills/${skill}/SKILL.md`;
    if (normalized.has(stalePath)) errors.push(`Stale client skill must not ship: ${stalePath}`);
  }

  return errors;
}

export function validateRootPackFiles(files: string[]): string[] {
  const normalized = new Set(files.map(f => f.replace(/\\/g, '/')));
  const errors: string[] = [];

  for (const expected of REQUIRED_ROOT_PACKAGE_FILES) {
    if (!normalized.has(expected)) errors.push(`Missing root package file: ${expected}`);
  }

  return errors;
}

export function validateReleaseMetadata(root: string): string[] {
  const errors: string[] = [];
  const rootPackagePath = join(root, 'package.json');
  const clientPackagePath = join(root, 'client', 'package.json');
  const lockPath = join(root, 'package-lock.json');

  const rootPackage = readJsonFile(rootPackagePath) as { version?: unknown };
  const clientPackage = readJsonFile(clientPackagePath) as { version?: unknown };
  const rootVersion = typeof rootPackage.version === 'string' ? rootPackage.version : '';
  const clientVersion = typeof clientPackage.version === 'string' ? clientPackage.version : '';

  if (!rootVersion) errors.push('Root package.json must define a version');
  if (!clientVersion) errors.push('Client package.json must define a version');
  if (rootVersion && clientVersion && rootVersion !== clientVersion) {
    errors.push(`Root and client package versions must match: ${rootVersion} !== ${clientVersion}`);
  }

  if (existsSync(lockPath)) {
    const lock = readJsonFile(lockPath) as { version?: unknown; packages?: Record<string, { version?: unknown }> };
    if (lock.version !== rootVersion) {
      errors.push(`package-lock.json version must match package.json: ${String(lock.version)} !== ${rootVersion}`);
    }
    const rootLockPackage = lock.packages?.[''];
    if (rootLockPackage?.version !== rootVersion) {
      errors.push(`package-lock root package version must match package.json: ${String(rootLockPackage?.version)} !== ${rootVersion}`);
    }
  }

  for (const doc of ACTIVE_RELEASE_DOCS) {
    const fullPath = join(root, doc);
    if (!existsSync(fullPath)) continue;
    const text = readFileSync(fullPath, 'utf8');
    if (text.includes('3.2.0') || text.includes('v3.2')) {
      errors.push(`Stale active release version in ${doc}`);
    }
  }

  return errors;
}

function parseSkillFrontmatter(text: string): Record<string, string> | null {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return null;

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (key) frontmatter[key] = value;
  }
  return frontmatter;
}

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

export function validateClientSkillSources(root: string): string[] {
  const errors: string[] = [];
  const skillsRoot = join(root, 'client', 'skills');
  const allowedSkillDirs = new Set<string>([...CANONICAL_CLIENT_SKILLS, 'evals']);

  if (!existsSync(skillsRoot)) {
    return ['Missing client skills directory: client/skills'];
  }

  for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && !allowedSkillDirs.has(entry.name)) {
      errors.push(`Unexpected top-level client skill directory: client/skills/${entry.name}`);
    }
  }

  for (const skill of CANONICAL_CLIENT_SKILLS) {
    const skillPath = join(skillsRoot, skill, 'SKILL.md');
    if (!existsSync(skillPath)) {
      errors.push(`Missing client skill source: client/skills/${skill}/SKILL.md`);
      continue;
    }

    const text = readFileSync(skillPath, 'utf8');
    const frontmatter = parseSkillFrontmatter(text);
    if (!frontmatter) {
      errors.push(`Client skill ${skill} must start with YAML frontmatter`);
      continue;
    }

    if (frontmatter.name !== skill) {
      errors.push(`Client skill ${skill} frontmatter name must be "${skill}"`);
    }
    if (!frontmatter.description) {
      errors.push(`Client skill ${skill} must define a frontmatter description`);
    } else if (!frontmatter.description.startsWith('Load when')) {
      errors.push(`Client skill ${skill} description must start with "Load when"`);
    }
  }

  const routingPath = join(skillsRoot, 'evals', 'routing.json');
  if (!existsSync(routingPath)) {
    errors.push('Missing client skill routing evals: client/skills/evals/routing.json');
    return errors;
  }

  let routing: unknown;
  try {
    routing = readJsonFile(routingPath);
  } catch (err) {
    errors.push(`Invalid routing eval JSON: ${(err as Error).message}`);
    return errors;
  }

  if (!routing || typeof routing !== 'object') {
    errors.push('Routing evals must be a JSON object');
    return errors;
  }

  const cases = (routing as { cases?: unknown }).cases;
  if (!Array.isArray(cases)) {
    errors.push('Routing evals must include a cases array');
    return errors;
  }

  const covered = new Set<string>();
  const canonicalSkills = new Set<string>(CANONICAL_CLIENT_SKILLS);

  for (const item of cases as RoutingEvalCase[]) {
    const name = typeof item.name === 'string' ? item.name : '<unnamed>';
    if (typeof item.user_request !== 'string' || !item.user_request.trim()) {
      errors.push(`Routing eval ${name} must include a user_request`);
    }

    if (typeof item.expected_skill !== 'string' || !canonicalSkills.has(item.expected_skill)) {
      errors.push(`Routing eval ${name} has invalid expected_skill`);
    } else {
      covered.add(item.expected_skill);
    }

    if (item.should_not_load !== undefined) {
      if (!Array.isArray(item.should_not_load)) {
        errors.push(`Routing eval ${name} should_not_load must be an array`);
      } else {
        for (const value of item.should_not_load) {
          if (typeof value !== 'string' || !canonicalSkills.has(value)) {
            errors.push(`Routing eval ${name} has invalid should_not_load value`);
          }
        }
      }
    }

    if (typeof item.expected_provider_reference === 'string') {
      const referencePath = join(skillsRoot, ...item.expected_provider_reference.split('/'));
      if (!existsSync(referencePath)) {
        errors.push(`Routing eval ${name} references missing file: ${item.expected_provider_reference}`);
      }
    }
  }

  for (const skill of CANONICAL_CLIENT_SKILLS) {
    if (!covered.has(skill)) errors.push(`Missing routing eval case for client skill: ${skill}`);
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

function runRootPackCheck(root: string): string[] {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const args = process.platform === 'win32'
    ? ['/c', 'npm', 'pack', '--dry-run']
    : ['pack', '--dry-run'];
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.status !== 0) {
    return [`root npm pack --dry-run failed: ${output.trim() || result.error?.message || 'unknown error'}`];
  }

  return validateRootPackFiles(parseNpmPackFiles(output));
}

export function runReleaseChecks(root: string): string[] {
  const errors: string[] = [];

  const staleFindings = findStaleReferences(root);
  for (const finding of staleFindings) {
    errors.push(
      `Stale reference ${finding.pattern} in ${finding.relativePath}:${finding.line}: ${finding.text}`
    );
  }

  errors.push(...validateReleaseMetadata(root));
  errors.push(...validateClientSkillSources(root));
  errors.push(...runRootPackCheck(root));
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
