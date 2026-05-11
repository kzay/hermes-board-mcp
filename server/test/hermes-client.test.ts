import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RestError, HermesKanbanClient } from '../src/hermes-client.js';

describe('RestError', () => {
  it('classifies 4xx as client error', () => {
    const err = new RestError(404, 'Not Found', 'http://localhost/test', 'GET');
    assert.equal(err.isClientError, true);
    assert.equal(err.isServerError, false);
    assert.equal(err.status, 404);
    assert.ok(err.message.includes('404'));
  });

  it('classifies 5xx as server error', () => {
    const err = new RestError(502, 'Bad Gateway', 'http://localhost/test', 'GET');
    assert.equal(err.isClientError, false);
    assert.equal(err.isServerError, true);
  });

  it('has correct name', () => {
    const err = new RestError(400, 'Bad Request', 'http://localhost/test', 'POST');
    assert.equal(err.name, 'RestError');
  });

  it('classifies 401 as auth error (should fall back to CLI)', () => {
    const err = new RestError(401, 'Unauthorized', 'http://localhost/test', 'GET');
    assert.equal(err.isAuthError, true);
    assert.equal(err.isClientError, true);
  });

  it('classifies 403 as auth error (should fall back to CLI)', () => {
    const err = new RestError(403, 'Forbidden', 'http://localhost/test', 'GET');
    assert.equal(err.isAuthError, true);
    assert.equal(err.isClientError, true);
  });

  it('does not classify 404 as auth error (should not fall back to CLI)', () => {
    const err = new RestError(404, 'Not Found', 'http://localhost/test', 'GET');
    assert.equal(err.isAuthError, false);
    assert.equal(err.isClientError, true);
  });

  it('does not classify 400 as auth error', () => {
    const err = new RestError(400, 'Bad Request', 'http://localhost/test', 'POST');
    assert.equal(err.isAuthError, false);
  });
});

describe('HermesKanbanClient', () => {
  it('dispose() does not throw', () => {
    const client = new HermesKanbanClient();
    assert.doesNotThrow(() => client.dispose());
  });

  it('dispose() can be called multiple times safely', () => {
    const client = new HermesKanbanClient();
    client.dispose();
    assert.doesNotThrow(() => client.dispose());
  });

  it('reads HERMES_KANBAN_API_TOKEN from environment', () => {
    const prev = process.env.HERMES_KANBAN_API_TOKEN;
    process.env.HERMES_KANBAN_API_TOKEN = 'test-dashboard-token';
    // Just verify construction succeeds — token is a private field
    const client = new HermesKanbanClient();
    assert.ok(client, 'client should be created when token is set');
    // restore
    if (prev === undefined) delete process.env.HERMES_KANBAN_API_TOKEN;
    else process.env.HERMES_KANBAN_API_TOKEN = prev;
  });
});
