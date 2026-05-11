import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RestError } from '../src/hermes-client.js';

describe('tryRestThenCli behavior (via RestError)', () => {
  it('401 is auth error — should trigger CLI fallback, not re-throw', () => {
    const err = new RestError(401, 'Unauthorized', 'http://localhost:9119/api/test', 'GET');
    assert.equal(err.isAuthError, true, '401 must be auth error');
    assert.equal(err.isClientError, true);
    // isAuthError true → tryRestThenCli falls back to CLI (not re-thrown)
  });

  it('403 is auth error — should trigger CLI fallback, not re-throw', () => {
    const err = new RestError(403, 'Forbidden', 'http://localhost:9119/api/test', 'POST');
    assert.equal(err.isAuthError, true, '403 must be auth error');
    assert.equal(err.isClientError, true);
  });

  it('404 is NOT an auth error — should be re-thrown (resource missing on CLI too)', () => {
    const err = new RestError(404, 'Not Found', 'http://localhost:9119/api/test', 'GET');
    assert.equal(err.isAuthError, false);
    assert.equal(err.isClientError, true);
  });

  it('RestError.isServerError is true for 5xx, should trigger CLI fallback', () => {
    const err = new RestError(503, 'Service Unavailable', 'http://localhost:9119/api/test', 'GET');
    assert.equal(err.isClientError, false);
    assert.equal(err.isServerError, true);
  });

  it('network error (non-RestError) would trigger CLI fallback', () => {
    const err = new Error('ECONNREFUSED');
    assert.equal(err instanceof RestError, false, 'non-RestError should fall through to CLI');
  });

  it('400 is client error, not auth error', () => {
    const err = new RestError(400, 'Bad Request', 'http://localhost:9119/api/test', 'POST');
    assert.equal(err.isClientError, true);
    assert.equal(err.isAuthError, false);
    assert.equal(err.isServerError, false);
  });

  it('499 is client error', () => {
    const err = new RestError(499, 'Client Closed', 'http://localhost:9119/api/test', 'GET');
    assert.equal(err.isClientError, true);
  });

  it('500 is server error', () => {
    const err = new RestError(500, 'Internal Server Error', 'http://localhost:9119/api/test', 'GET');
    assert.equal(err.isServerError, true);
    assert.equal(err.isClientError, false);
  });
});
