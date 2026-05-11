/**
 * Resolve board slug → project metadata from factory-project.yaml files.
 *
 * Each onboarded project has a metadata file at:
 *   /opt/hermes/projects/<slug>/factory-project.yaml
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

export interface ProjectMeta {
  repo_url: string;
  board: string;
  repo_aliases: string[];
  default_branch: string;
}

const PROJECTS_BASE = process.env.HERMES_PROJECTS_BASE || '/opt/hermes/projects';
const REPO_CACHE_TTL_MS = 60_000;

interface RepoCacheEntry {
  result: (ProjectMeta & { board: string }) | null;
  ts: number;
}

const _repoCache = new Map<string, RepoCacheEntry>();

export function resolveProject(boardSlug?: string | null): ProjectMeta | null {
  if (!boardSlug) return null;

  const metaPath = join(PROJECTS_BASE, boardSlug, 'factory-project.yaml');
  if (!existsSync(metaPath)) return null;

  try {
    const raw = readFileSync(metaPath, 'utf8');
    const data = yaml.load(raw) as Record<string, unknown> | undefined || {};
    return {
      repo_url: data.repo_url ? String(data.repo_url) : '',
      board: data.board ? String(data.board) : boardSlug,
      repo_aliases: Array.isArray(data.repo_aliases)
        ? data.repo_aliases.map(a => String(a))
        : [],
      default_branch: data.default_branch ? String(data.default_branch) : 'main',
    };
  } catch {
    return null;
  }
}

// ── Repo normalization ────────────────────────────────────────────

/**
 * Normalize a Git URL for comparison by stripping scheme, trailing `.git`,
 * and converting to lowercase.
 */
export function normalizeRepoUrl(url: string): string {
  let normalized = url.toLowerCase().trim();
  // Strip scheme
  normalized = normalized.replace(/^(https?:\/\/|git@)/, '');
  // Strip trailing .git
  normalized = normalized.replace(/\.git$/, '');
  // Convert : to / for SSH format (e.g., github.com:owner/repo)
  normalized = normalized.replace(/^([^/]+):/, '$1/');
  return normalized;
}

/**
 * Resolve project meta by repo URL or alias. Checks the repo_url field
 * and any configured aliases in factory-project.yaml.
 */
export function resolveProjectByRepo(urlOrAlias: string): ProjectMeta & { board: string } | null {
  const target = normalizeRepoUrl(urlOrAlias);

  const cached = _repoCache.get(target);
  if (cached && Date.now() - cached.ts < REPO_CACHE_TTL_MS) {
    return cached.result;
  }

  const result = _resolveProjectByRepoUncached(target);
  _repoCache.set(target, { result, ts: Date.now() });
  return result;
}

function _resolveProjectByRepoUncached(target: string): (ProjectMeta & { board: string }) | null {

  try {
    const entries = readdirSync(PROJECTS_BASE, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const board = entry.name;
      const metaPath = join(PROJECTS_BASE, board, 'factory-project.yaml');
      if (!existsSync(metaPath)) continue;

      try {
        const raw = readFileSync(metaPath, 'utf8');
        const data = yaml.load(raw) as Record<string, unknown> | undefined || {};
        const repoUrl = data.repo_url ? normalizeRepoUrl(String(data.repo_url)) : '';
        const aliases = Array.isArray(data.repo_aliases)
          ? data.repo_aliases.map(a => normalizeRepoUrl(String(a)))
          : [];

        if (repoUrl === target || aliases.includes(target)) {
          const project = resolveProject(board);
          if (!project) return null;
          return {
            ...project,
            board,
          };
        }
      } catch {
        continue;
      }
    }
  } catch {
    // PROJECTS_BASE may not exist
  }

  return null;
}
