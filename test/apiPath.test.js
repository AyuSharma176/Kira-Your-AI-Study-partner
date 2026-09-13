import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExpressRequestUrl } from '../api/normalizePath.js';

test('restores the API path from the Vercel rewrite parameter', () => {
  assert.equal(
    buildExpressRequestUrl('/api/handler?path=auth/login'),
    '/api/auth/login',
  );
});

test('preserves request query parameters while removing the routing parameter', () => {
  assert.equal(
    buildExpressRequestUrl('/api/handler?path=auth%2Fme&include=profile'),
    '/api/auth/me?include=profile',
  );
});
