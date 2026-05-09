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
  openspec_root: string;
  project_root: string;
  worktree_root: string;
  repo_url: string;
  board: string;
  repo_aliases: string[];
  default_branch: string;
}

const PROJECTS_BASE = process.env.HERMES_PROJECTS_BASE || '/opt/hermes/projects';
const DEFAULT_OPENSPEC_ROOT = process.env.HERMES_OPENSPEC_ROOT
  || join(process.env.HOME || '/root', '.hermes', 'factory', 'openspec');

export function resolveProject(boardSlug?: string | null): ProjectMeta | null {
  if (!boardSlug) return null;

  const metaPath = join(PROJECTS_BASE, boardSlug, 'factory-project.yaml');
  if (!existsSync(metaPath)) return null;

  try {
    const raw = readFileSync(metaPath, 'utf8');
    const data = yaml.load(raw) as Record<string, unknown> | undefined || {};
    return {
      openspec_root: data.openspec_root ? String(data.openspec_root) : DEFAULT_OPENSPEC_ROOT,
      project_root: data.project_root ? String(data.project_root) : '',
      worktree_root: data.worktree_root ? String(data.worktree_root) : '',
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

/**
 * Resolve the OpenSpec root for a given project slug, falling back to the
 * factory-level default if no project metadata exists.
 */
export function resolveOpenspecRoot(projectSlug?: string | null): string {
  const project = resolveProject(projectSlug);
  return project?.openspec_root || DEFAULT_OPENSPEC_ROOT;
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
