/**
 * Speckit provider — resolves `speckit:<identifier>` references.
 *
 * Placeholder implementation: throws until speckit integration is complete.
 */
import type { SpecProvider, BuildBodyOpts } from './types.js';

export class SpeckitProvider implements SpecProvider {
  readonly name = 'speckit';

  canResolve(specRef: string): boolean {
    return specRef.startsWith('speckit:');
  }

  buildBody(specRef: string, _opts: BuildBodyOpts): string {
    const identifier = specRef.slice('speckit:'.length);
    if (!identifier) {
      throw new Error(`Invalid speckit spec_ref: "${specRef}" — missing identifier after prefix`);
    }
    throw new Error(
      `SpeckitProvider is not yet implemented. Cannot build body for "${specRef}". ` +
      `Install and configure Speckit integration to enable this provider.`
    );
  }
}
