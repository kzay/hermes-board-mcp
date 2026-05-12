/**
 * OpenSpec provider — resolves `openspec:<change-name>` references.
 *
 * Derives spec_path from the change name using the OpenSpec convention:
 *   openspec/changes/<change-name>/
 *
 * Supports configurable provider roots via opts.specBasePath.
 */
import type { SpecProvider, BuildBodyOpts } from './types.js';

export class OpenSpecProvider implements SpecProvider {
  readonly name = 'openspec';

  canResolve(specRef: string): boolean {
    return specRef.startsWith('openspec:');
  }

  buildBody(specRef: string, opts: BuildBodyOpts): string {
    const changeName = specRef.slice('openspec:'.length);
    if (!changeName) {
      throw new Error(`Invalid openspec spec_ref: "${specRef}" — missing change name after prefix`);
    }

    const root = ensureTrailingSlash(opts.specBasePath ?? 'openspec/');
    const specPath = `${root}changes/${changeName}/`;

    const lines = [
      '```hermes-board-spec',
      `spec_provider: openspec`,
      `spec_ref: ${specRef}`,
      `spec_path: ${specPath}`,
      `repo_url: ${opts.repoUrl}`,
      `base_branch: ${opts.baseBranch}`,
      `base_commit: ${opts.baseCommit}`,
      '```',
    ];

    return lines.join('\n');
  }
}

function ensureTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}
