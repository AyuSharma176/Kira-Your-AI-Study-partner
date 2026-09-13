import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeApiPath } from '../api/normalizePath.js';

test('restores the API prefix when Vercel passes a catch-all route suffix', () => {
  assert.equal(normalizeApiPath('/auth/login'), '/api/auth/login');
});

test('does not duplicate an existing API prefix', () => {
  assert.equal(normalizeApiPath('/api/auth/login'), '/api/auth/login');
});
