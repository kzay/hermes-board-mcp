import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerProvider, resolveProvider, clearProviders } from '../src/spec-providers/registry.js';
import type { SpecProvider } from '../src/spec-providers/types.js';

function stubProvider(prefix: string): SpecProvider {
  return {
    name: prefix,
    canResolve(ref) { return ref.startsWith(`${prefix}:`); },
    buildBody(ref, opts) {
      return `stub:${ref}:${opts.baseCommit}`;
    },
  };
}

describe('spec-provider registry', () => {
  beforeEach(() => {
    clearProviders();
  });

  it('resolves the correct provider by prefix', () => {
    registerProvider(stubProvider('openspec'));
    registerProvider(stubProvider('speckit'));

    const p = resolveProvider('openspec:add-dark-mode');
    assert.equal(p.name, 'openspec');
  });

  it('resolves speckit provider', () => {
    registerProvider(stubProvider('openspec'));
    registerProvider(stubProvider('speckit'));

    const p = resolveProvider('speckit:feature/42');
    assert.equal(p.name, 'speckit');
  });

  it('throws for unknown prefix', () => {
    registerProvider(stubProvider('openspec'));

    assert.throws(
      () => resolveProvider('unknown:foo'),
      /No spec provider registered for prefix "unknown"/,
    );
  });

  it('throws for empty spec_ref', () => {
    registerProvider(stubProvider('openspec'));

    assert.throws(
      () => resolveProvider(''),
      /No spec provider registered/,
    );
  });

  it('first registered provider wins when multiple match', () => {
    const broad: SpecProvider = {
      name: 'catch-all',
      canResolve() { return true; },
      buildBody() { return 'catch-all'; },
    };
    registerProvider(broad);
    registerProvider(stubProvider('openspec'));

    const p = resolveProvider('openspec:test');
    assert.equal(p.name, 'catch-all');
  });
});
