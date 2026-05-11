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
});
