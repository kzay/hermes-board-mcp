/**
 * Spec provider registry — resolves a spec_ref to the appropriate provider.
 */
import type { SpecProvider } from './types.js';

const providers: SpecProvider[] = [];

export function registerProvider(provider: SpecProvider): void {
  providers.push(provider);
}

export function resolveProvider(specRef: string): SpecProvider {
  const match = providers.find(p => p.canResolve(specRef));
  if (!match) {
    const prefix = specRef.split(':')[0] || specRef;
    throw new Error(`No spec provider registered for prefix "${prefix}" (spec_ref: "${specRef}")`);
  }
  return match;
}

export function getRegisteredProviders(): readonly SpecProvider[] {
  return providers;
}

export function clearProviders(): void {
  providers.length = 0;
}
