/* @vitest-environment jsdom */
import { expect, it } from 'vitest';
import { decodeRagSources } from '../src/ragSources.js';

function toBase64Url(value) {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

it('decodes a valid base64url source header', () => {
  const sources = [{
    noteId: 'n1',
    chunkId: 'c1',
    filename: 'biology.pdf',
    excerpt: 'Chlorophyll captures light.',
    score: 0.82,
  }];

  expect(decodeRagSources(toBase64Url(sources))).toEqual(sources);
});

it('returns an empty list for absent or malformed source headers', () => {
  expect(decodeRagSources(null)).toEqual([]);
  expect(decodeRagSources('not-valid')).toEqual([]);
});
