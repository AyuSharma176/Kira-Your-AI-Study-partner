import handler, { maxDuration } from './index.js';
import { normalizeApiPath } from './normalizePath.js';

export { maxDuration };

export default function catchAllApiHandler(req, res) {
  req.url = normalizeApiPath(req.url);
  return handler(req, res);
}
