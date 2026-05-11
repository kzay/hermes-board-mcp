/**
 * Spec providers barrel — registers all known providers.
 *
 * Import this module at server startup to populate the registry.
 */
export { registerProvider, resolveProvider, clearProviders, getRegisteredProviders } from './registry.js';
export type { SpecProvider, BuildBodyOpts } from './types.js';
export { OpenSpecProvider } from './openspec.js';
export { SpeckitProvider } from './speckit.js';

import { registerProvider } from './registry.js';
import { OpenSpecProvider } from './openspec.js';
import { SpeckitProvider } from './speckit.js';

export function initSpecProviders(): void {
  registerProvider(new OpenSpecProvider());
  registerProvider(new SpeckitProvider());
}
