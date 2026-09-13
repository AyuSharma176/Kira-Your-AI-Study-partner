import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlobController } from '../controllers/blobController.js';

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('generates a PDF-only upload token scoped to the authenticated user', async () => {
  const { handleClientUploadRequest } = createBlobController({
    handleClientUpload: async ({ onBeforeGenerateToken }) => {
      const options = await onBeforeGenerateToken('uploads/user-a/notes.pdf');
      assert.deepEqual(options.allowedContentTypes, ['application/pdf']);
      assert.equal(options.maximumSizeInBytes, 15 * 1024 * 1024);
      assert.equal(options.addRandomSuffix, true);
      return { type: 'blob.generate-client-token', clientToken: 'token' };
    },
  });
  const res = createResponse();

  await handleClientUploadRequest({ body: {}, user: { _id: 'user-a' } }, res, assert.fail);

  assert.deepEqual(res.body, { type: 'blob.generate-client-token', clientToken: 'token' });
});

test('rejects a Blob pathname outside the authenticated user folder', async () => {
  const { handleClientUploadRequest } = createBlobController({
    handleClientUpload: async ({ onBeforeGenerateToken }) => onBeforeGenerateToken('uploads/user-b/notes.pdf'),
  });
  const res = createResponse();
  let receivedError;

  await handleClientUploadRequest({ body: {}, user: { _id: 'user-a' } }, res, (error) => { receivedError = error; });

  assert.match(receivedError.message, /authorized upload path/i);
});
