/**
 * Speckit provider — resolves `speckit:<identifier>` references.
 *
 * Derives spec_path from the identifier using the SpecKit convention:
 *   speckit/specs/<identifier>/
 *
 * Supports configurable provider roots via opts.specBasePath.
 */
import type { SpecProvider, BuildBodyOpts } from './types.js';

export class SpeckitProvider implements SpecProvider {
  readonly name = 'speckit';

  canResolve(specRef: string): boolean {
    return specRef.startsWith('speckit:');
  }

  buildBody(specRef: string, opts: BuildBodyOpts): string {
    const identifier = specRef.slice('speckit:'.length);
    if (!identifier) {
      throw new Error(`Invalid speckit spec_ref: "${specRef}" — missing identifier after prefix`);
    }

    const root = ensureTrailingSlash(opts.specBasePath ?? 'speckit/');
    const specPath = `${root}specs/${identifier}/`;

    const lines = [
      '```hermes-board-spec',
      `spec_provider: speckit`,
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
