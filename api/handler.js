import app from '../server/app.js';
import { connectDatabase } from '../server/config/db.js';
import { buildExpressRequestUrl } from './normalizePath.js';

export const maxDuration = 300;

let databaseConnection;

export default async function handler(req, res) {
  req.url = buildExpressRequestUrl(req.url);

  databaseConnection ||= connectDatabase().catch((error) => {
    databaseConnection = undefined;
    throw error;
  });
  await databaseConnection;

  return app(req, res);
}
