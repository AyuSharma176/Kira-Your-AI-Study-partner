import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { del, get } from '@vercel/blob';

export const MAX_PDF_SIZE = 15 * 1024 * 1024;

export function isOwnedPrivateBlobUrl(blobUrl, userId) {
  try {
    const url = new URL(blobUrl);
    const pathname = decodeURIComponent(url.pathname);
    return url.protocol === 'https:'
      && url.hostname.endsWith('.private.blob.vercel-storage.com')
      && pathname.startsWith(`/uploads/${userId}/`);
  } catch {
    return false;
  }
}

export function createBlobService({ getBlob = get, deleteBlob = del, removeFile = fs.rm } = {}) {
  async function deletePdf(blobUrl) {
    await deleteBlob(blobUrl);
  }

  async function downloadPdf(blobUrl) {
    const result = await getBlob(blobUrl, { access: 'private' });
    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new Error('The uploaded PDF could not be retrieved from storage.');
    }
    if (result.blob?.size > MAX_PDF_SIZE) {
      throw new Error('This file is over the 15 MB limit.');
    }

    const temporaryPath = path.join(os.tmpdir(), `studybot-${randomUUID()}.pdf`);
    try {
      await pipeline(Readable.fromWeb(result.stream), createWriteStream(temporaryPath));
    } catch (error) {
      await removeFile(temporaryPath, { force: true }).catch(() => {});
      throw error;
    }

    return {
      path: temporaryPath,
      cleanup: async () => {
        await Promise.allSettled([
          removeFile(temporaryPath, { force: true }),
          deletePdf(blobUrl),
        ]);
      },
    };
  }

  return { downloadPdf, deletePdf };
}

export const { downloadPdf, deletePdf } = createBlobService();
