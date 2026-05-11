import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('auth', () => {
  let authenticateRequest: typeof import('../src/auth.js').authenticateRequest;
  let initAuth: typeof import('../src/auth.js').initAuth;

  function fakeReq(headers: Record<string, string> = {}, remoteAddress = '192.168.1.1') {
    return {
      headers,
      socket: { remoteAddress },
    } as unknown as import('http').IncomingMessage;
  }

  beforeEach(async () => {
    delete process.env.BOARD_MCP_TOKENS;
    delete process.env.BOARD_MCP_REQUIRE_AUTH;
    // Re-import to reset module state
    const mod = await import('../src/auth.js?t=' + Date.now());
    authenticateRequest = mod.authenticateRequest;
    initAuth = mod.initAuth;
  });

  it('allows loopback requests without token', () => {
    process.env.BOARD_MCP_TOKENS = 'secret123';
    initAuth();
    const result = authenticateRequest(fakeReq({}, '127.0.0.1'));
    assert.equal(result.ok, true);
  });

  it('allows loopback IPv6', () => {
    process.env.BOARD_MCP_TOKENS = 'secret123';
    initAuth();
    const result = authenticateRequest(fakeReq({}, '::1'));
    assert.equal(result.ok, true);
  });

  it('rejects external request without token', () => {
    process.env.BOARD_MCP_TOKENS = 'secret123';
    initAuth();
    const result = authenticateRequest(fakeReq({}, '10.0.0.1'));
    assert.equal(result.ok, false);
    assert.match(result.error!, /missing/i);
  });

  it('accepts valid bearer token', () => {
    process.env.BOARD_MCP_TOKENS = 'mytoken';
    initAuth();
    const result = authenticateRequest(
      fakeReq({ authorization: 'Bearer mytoken' }, '10.0.0.1')
    );
    assert.equal(result.ok, true);
  });

  it('rejects invalid bearer token', () => {
    process.env.BOARD_MCP_TOKENS = 'mytoken';
    initAuth();
    const result = authenticateRequest(
      fakeReq({ authorization: 'Bearer wrongtoken' }, '10.0.0.1')
    );
    assert.equal(result.ok, false);
    assert.match(result.error!, /invalid token/i);
  });

  it('returns bound profile from token', () => {
    process.env.BOARD_MCP_TOKENS = 'tok1:orchestrator,tok2:builder';
    initAuth();
    const r1 = authenticateRequest(
      fakeReq({ authorization: 'Bearer tok1' }, '10.0.0.1')
    );
    assert.equal(r1.ok, true);
    assert.equal(r1.profile, 'orchestrator');

    const r2 = authenticateRequest(
      fakeReq({ authorization: 'Bearer tok2' }, '10.0.0.1')
    );
    assert.equal(r2.ok, true);
    assert.equal(r2.profile, 'builder');
  });

  it('enforces auth on loopback when REQUIRE_AUTH=always', () => {
    process.env.BOARD_MCP_TOKENS = 'mytoken';
    process.env.BOARD_MCP_REQUIRE_AUTH = 'always';
    initAuth();
    const result = authenticateRequest(fakeReq({}, '127.0.0.1'));
    assert.equal(result.ok, false);
  });
});
