import assert from 'node:assert/strict';
import test from 'node:test';
import { createChatController } from '../controllers/chatController.js';
import { createUploadController } from '../controllers/uploadController.js';

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function createStreamingResponse() {
  return {
    statusCode: 200,
    body: '',
    headers: {},
    ended: false,
    status(code) { this.statusCode = code; return this; },
    set(headers) { Object.assign(this.headers, headers); return this; },
    flushHeaders() {},
    write(chunk) { this.body += chunk; },
    end() { this.ended = true; },
  };
}

test('re-indexing returns 404 when the requested note is not owned by the user', async () => {
  const { reindexNote } = createUploadController({
    NoteModel: { findOne: async () => null },
    index: async () => assert.fail('indexing must not run for an unowned note'),
  });
  const res = createResponse();

  await reindexNote({ params: { id: '507f1f77bcf86cd799439011' }, user: { _id: 'user-a' } }, res, assert.fail);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.message, 'Study guide not found.');
});

test('re-indexing returns the owned note after rebuilding its chunks', async () => {
  const note = { _id: 'note-1', ragStatus: 'failed' };
  const { reindexNote } = createUploadController({
    NoteModel: { findOne: async () => note },
    index: async (indexedNote) => { indexedNote.ragStatus = 'ready'; },
  });
  const res = createResponse();

  await reindexNote({ params: { id: '507f1f77bcf86cd799439011' }, user: { _id: 'user-a' } }, res, assert.fail);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.note.ragStatus, 'ready');
});

test('analyzes a private Blob upload and cleans it up after extraction', async () => {
  let cleaned = false;
  const { uploadAndAnalyze } = createUploadController({
    NoteModel: { findOne: async () => null, create: async (note) => ({ _id: 'note-1', ...note }) },
    downloadPdf: async () => ({
      path: 'temporary.pdf',
      cleanup: async () => { cleaned = true; },
    }),
    extractPdf: async () => 'Readable PDF content with more than thirty characters.',
    analyze: async () => ({ topics: [] }),
    index: async () => {},
  });
  const res = createResponse();

  await uploadAndAnalyze({
    body: {
      blobUrl: 'https://store.private.blob.vercel-storage.com/uploads/user-a/notes.pdf',
      originalFilename: 'notes.pdf',
    },
    user: { _id: 'user-a' },
  }, res, assert.fail);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.note.originalFilename, 'notes.pdf');
  assert.equal(cleaned, true);
});

test('chat streams a grounded reply and persists matching sources', async () => {
  const savedSnapshots = [];
  const chat = {
    _id: 'chat-1',
    messages: [],
    save: async () => savedSnapshots.push(structuredClone(chat.messages)),
  };
  const matches = [{
    _id: 'chunk-1',
    noteId: 'note-1',
    originalFilename: 'biology.pdf',
    text: 'Chlorophyll captures sunlight for photosynthesis.',
    score: 0.82,
  }];
  let receivedContext = '';
  const { sendMessage } = createChatController({
    ChatModel: { create: async () => chat },
    retrieve: async () => matches,
    stream: async function* stream(_messages, ragContext) {
      receivedContext = ragContext;
      yield 'Grounded ';
      yield 'reply';
    },
    logger: { error() {} },
  });
  const res = createStreamingResponse();

  await sendMessage({ body: { message: 'How does photosynthesis work?' }, user: { _id: 'user-a' } }, res, assert.fail);

  const expectedSources = [{
    noteId: 'note-1',
    chunkId: 'chunk-1',
    filename: 'biology.pdf',
    excerpt: 'Chlorophyll captures sunlight for photosynthesis.',
    score: 0.82,
  }];
  assert.equal(res.headers['X-RAG-Sources'], Buffer.from(JSON.stringify(expectedSources)).toString('base64url'));
  assert.equal(res.body, 'Grounded reply');
  assert.equal(res.ended, true);
  assert.match(receivedContext, /UNTRUSTED REFERENCE MATERIAL/);
  assert.deepEqual(chat.messages.at(-1), { role: 'assistant', content: 'Grounded reply', sources: expectedSources });
  assert.equal(savedSnapshots.length, 2);
});

test('chat falls back to a normal stream when retrieval is unavailable', async () => {
  const chat = {
    _id: 'chat-2',
    messages: [],
    save: async () => {},
  };
  let receivedContext = 'not-reset';
  const { sendMessage } = createChatController({
    ChatModel: { create: async () => chat },
    retrieve: async () => { throw new Error('embedding unavailable'); },
    stream: async function* stream(_messages, ragContext) {
      receivedContext = ragContext;
      yield 'General reply';
    },
    logger: { error() {} },
  });
  const res = createStreamingResponse();

  await sendMessage({ body: { message: 'Explain gravity.' }, user: { _id: 'user-a' } }, res, assert.fail);

  assert.equal(receivedContext, '');
  assert.equal(res.headers['X-RAG-Sources'], Buffer.from('[]').toString('base64url'));
  assert.equal(res.body, 'General reply');
  assert.deepEqual(chat.messages.at(-1).sources, []);
});
