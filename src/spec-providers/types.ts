/**
 * Spec provider plugin interface.
 *
 * Each provider maps a `spec_ref` prefix to a formatted task body
 * that gives a Hermes worker enough context to check out and read the spec.
 */

export interface BuildBodyOpts {
  repoUrl: string;
  baseBranch: string;
  baseCommit: string;
}

export interface SpecProvider {
  readonly name: string;
  canResolve(specRef: string): boolean;
  buildBody(specRef: string, opts: BuildBodyOpts): string;
}
