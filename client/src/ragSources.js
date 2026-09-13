function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function isSourceRecord(value) {
  return value
    && typeof value === 'object'
    && typeof value.noteId === 'string' && value.noteId.trim()
    && typeof value.chunkId === 'string' && value.chunkId.trim()
    && typeof value.filename === 'string' && value.filename.trim()
    && typeof value.excerpt === 'string' && value.excerpt.trim()
    && Number.isFinite(value.score);
}

/** Decode only source records that are safe to render beneath an assistant reply. */
export function decodeRagSources(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return [];

  try {
    const parsed = JSON.parse(decodeBase64Url(headerValue));
    return Array.isArray(parsed) ? parsed.filter(isSourceRecord) : [];
  } catch {
    return [];
  }
}
