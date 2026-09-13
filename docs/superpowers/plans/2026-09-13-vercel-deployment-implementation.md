# StudyBot Vercel Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the existing React and Express application as one Vercel project while supporting authenticated direct PDF uploads to private Vercel Blob storage.

**Architecture:** Extract the Express app from the local `listen` entry point and export it through `api/index.js` for Vercel Functions. The browser uploads PDFs directly to a private Blob store through a protected token endpoint, then submits the resulting Blob URL for server-side temporary download, extraction, analysis, indexing, and cleanup.

**Tech Stack:** React 18, Vite, Express 5, MongoDB/Mongoose, `@vercel/blob`, Node.js 20, Vercel Functions.

**Spec:** `docs/superpowers/specs/2026-09-13-vercel-deployment-design.md`

## Global Constraints

- Keep the PDF maximum size at exactly 15 MiB (`15 * 1024 * 1024`).
- Keep uploaded PDFs private and delete each Blob after analysis succeeds or fails.
- Never commit `BLOB_READ_WRITE_TOKEN`, MongoDB credentials, Gemini credentials, or JWT secrets.
- Retain local Vite-to-Express development through the `/api` proxy.
- Preserve same-origin `/api` calls and httpOnly cookies in production.

---

### Task 1: Serverless Express application entry

**Files:**
- Create: `server/app.js`
- Create: `api/index.js`
- Modify: `server/server.js`
- Create: `vercel.json`
- Test: `server/test/app.test.js`

**Interfaces:**
- Produces `app` as the default export from `server/app.js`.
- Produces `api/index.js` default export, an Express-compatible Vercel Function handler.

- [ ] **Step 1: Write the failing application test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../app.js';

test('the serverless app exposes the health endpoint without opening a listener', () => {
  assert.equal(typeof app, 'function');
  assert.equal(app._router?.stack.some((layer) => layer.route?.path === '/api/health'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix server -- test/app.test.js`

Expected: FAIL because `server/app.js` does not exist.

- [ ] **Step 3: Extract app configuration and add the Vercel entry**

```js
// server/app.js
const app = express();
// existing middleware and route registration
export default app;

// api/index.js
import app from '../server/app.js';
export const maxDuration = 300;
export default app;
```

Keep `connectDatabase().then(() => app.listen(...))` only in `server/server.js`. Add `vercel.json` with the Vite build command, `client/dist` output directory, and a 300-second duration for `api/index.js`.

- [ ] **Step 4: Run the application test to verify it passes**

Run: `npm test --prefix server -- test/app.test.js`

Expected: PASS.

- [ ] **Step 5: Commit task changes**

```bash
git add server/app.js server/server.js api/index.js vercel.json server/test/app.test.js
git commit -m "feat: add Vercel serverless API entry"
```

### Task 2: Secure direct Blob upload token endpoint

**Files:**
- Create: `server/services/blobService.js`
- Create: `server/controllers/blobController.js`
- Modify: `server/routes/upload.js`
- Modify: `server/package.json`
- Modify: `server/package-lock.json`
- Test: `server/test/blobController.test.js`

**Interfaces:**
- Produces `createBlobController({ handleClientUpload })` returning `handleClientUploadRequest(req, res, next)`.
- Produces `createBlobService({ fetchImpl, deleteBlob })` returning `downloadPdf(url)` and `deletePdf(url)`.
- Adds protected `POST /api/upload/blob` for Vercel Blob token exchange callbacks.

- [ ] **Step 1: Write the failing controller tests**

```js
test('generates a client-upload token only for the authenticated user pathname', async () => {
  const handleClientUploadRequest = createBlobController({
    handleClientUpload: async ({ onBeforeGenerateToken }) => {
      const options = await onBeforeGenerateToken('uploads/user-a/notes.pdf');
      assert.deepEqual(options.allowedContentTypes, ['application/pdf']);
      assert.equal(options.maximumSizeInBytes, 15 * 1024 * 1024);
      return { type: 'blob.generate-client-token', clientToken: 'token' };
    },
  }).handleClientUploadRequest;
  const res = createResponse();
  await handleClientUploadRequest({ body: {}, user: { _id: 'user-a' } }, res, assert.fail);
  assert.deepEqual(res.body, { type: 'blob.generate-client-token', clientToken: 'token' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix server -- test/blobController.test.js`

Expected: FAIL because the Blob controller module does not exist.

- [ ] **Step 3: Implement the protected handler**

Install `@vercel/blob` in `server`. Call `handleUpload` from `@vercel/blob/client` with the Express request and body. In `onBeforeGenerateToken`, reject any pathname not starting with `uploads/${req.user._id}/`, return `access: 'private'` through client options, `allowedContentTypes: ['application/pdf']`, `maximumSizeInBytes: 15 * 1024 * 1024`, `addRandomSuffix: true`, and a short `validUntil`. Implement a no-op successful completion callback because the analysis request follows from the browser.

- [ ] **Step 4: Run the controller tests to verify they pass**

Run: `npm test --prefix server -- test/blobController.test.js`

Expected: PASS.

- [ ] **Step 5: Commit task changes**

```bash
git add server/services/blobService.js server/controllers/blobController.js server/routes/upload.js server/package.json server/package-lock.json server/test/blobController.test.js
git commit -m "feat: add protected Vercel Blob uploads"
```

### Task 3: Blob-backed PDF analysis and cleanup

**Files:**
- Modify: `server/controllers/uploadController.js`
- Modify: `server/routes/upload.js`
- Delete: `server/middleware/upload.js`
- Test: `server/test/controllers.test.js`

**Interfaces:**
- `uploadAndAnalyze(req, res, next)` accepts `{ blobUrl, originalFilename }` JSON body.
- `downloadPdf(blobUrl)` returns `{ path, cleanup }`; `cleanup()` is idempotent.

- [ ] **Step 1: Write failing upload-controller tests**

```js
test('analyzes a user-scoped private Blob and cleans it up', async () => {
  let cleaned = false;
  const { uploadAndAnalyze } = createUploadController({
    NoteModel: { findOne: async () => null, create: async (note) => note },
    downloadPdf: async () => ({ path: 'temporary.pdf', cleanup: async () => { cleaned = true; } }),
    extractPdf: async () => 'Readable PDF content long enough to analyze.',
    analyze: async () => ({ topics: [] }),
    index: async () => {},
  });
  const res = createResponse();
  await uploadAndAnalyze({ body: { blobUrl: 'https://store.private.blob.vercel-storage.com/uploads/user-a/a.pdf', originalFilename: 'a.pdf' }, user: { _id: 'user-a' } }, res, assert.fail);
  assert.equal(res.statusCode, 201);
  assert.equal(cleaned, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix server -- test/controllers.test.js`

Expected: FAIL because the controller expects `req.file` rather than a Blob URL.

- [ ] **Step 3: Implement the Blob analysis flow**

Validate `blobUrl` as a private Vercel Blob URL and validate `originalFilename` as a PDF. Check duplicates before downloading. Download to `os.tmpdir()`, enforce the 15 MiB response size, pass the temporary pathname to existing PDF extraction, and in a `finally` block remove both the temporary file and the Blob. Remove Multer and the disk upload middleware from the route.

- [ ] **Step 4: Run upload-controller tests to verify they pass**

Run: `npm test --prefix server -- test/controllers.test.js`

Expected: PASS.

- [ ] **Step 5: Commit task changes**

```bash
git add server/controllers/uploadController.js server/routes/upload.js server/middleware/upload.js server/test/controllers.test.js
git commit -m "feat: analyze PDFs from private Blob storage"
```

### Task 4: Browser upload flow and deployment documentation

**Files:**
- Modify: `client/src/pages/UploadPage.jsx`
- Modify: `client/package.json`
- Modify: `client/package-lock.json`
- Modify: `server/.env.example`
- Modify: `README.md`
- Test: `client/test/UploadPage.test.jsx`

**Interfaces:**
- The page calls `upload('uploads/<user id>/<filename>', file, { access: 'private', handleUploadUrl: '/api/upload/blob', multipart: true })` then posts the returned URL to `/api/upload/pdf`.

- [ ] **Step 1: Write the failing upload page test**

```jsx
it('sends the direct-upload Blob URL to the analysis endpoint', async () => {
  upload.mockResolvedValue({ url: 'https://store.private.blob.vercel-storage.com/uploads/user-a/note.pdf' });
  api.post.mockResolvedValue({ note: { _id: 'note-1' } });
  render(<UploadPage onComplete={onComplete} />);
  await userEvent.upload(screen.getByLabelText(/pdf/i), new File(['pdf'], 'note.pdf', { type: 'application/pdf' }));
  await userEvent.click(screen.getByRole('button', { name: /analyze my notes/i }));
  await waitFor(() => assert.deepEqual(api.post.mock.calls.at(-1), ['/api/upload/pdf', { blobUrl: expect.any(String), originalFilename: 'note.pdf' }]));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix client -- UploadPage.test.jsx`

Expected: FAIL because the page sends `FormData` to `/api/upload/pdf`.

- [ ] **Step 3: Implement the browser flow and docs**

Install `@vercel/blob` in `client`, use its browser `upload` method with `multipart: true`, update page state to show upload progress, then call `api.post` with `blobUrl` and `originalFilename`. Add `BLOB_READ_WRITE_TOKEN` and Vercel-specific variables to the environment example. Document project import, Vercel Blob creation, MongoDB Atlas network access, exact Vercel environment variables, and `vercel --prod` deployment.

- [ ] **Step 4: Run the upload-page test to verify it passes**

Run: `npm test --prefix client -- UploadPage.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit task changes**

```bash
git add client/src/pages/UploadPage.jsx client/package.json client/package-lock.json server/.env.example README.md client/test/UploadPage.test.jsx
git commit -m "feat: upload StudyBot PDFs directly to Vercel Blob"
```

### Task 5: Full deployment verification

**Files:**
- Modify only if verification exposes a defect.

**Interfaces:**
- Verifies the production Vercel function entry, API test suite, client test suite, and production Vite bundle.

- [ ] **Step 1: Run server tests**

Run: `npm test --prefix server`

Expected: all server tests pass.

- [ ] **Step 2: Run client tests**

Run: `npm test --prefix client`

Expected: all client tests pass.

- [ ] **Step 3: Run production client build**

Run: `npm run build --prefix client`

Expected: Vite exits with status 0 and writes `client/dist`.

- [ ] **Step 4: Inspect the deployment configuration**

Run: `npx vercel build`

Expected: Vercel detects `client/dist` static output and `api/index.js` as the Node.js function without missing configuration.

- [ ] **Step 5: Commit verification fixes if needed**

```bash
git add <verified-files>
git commit -m "fix: finalize Vercel deployment configuration"
```
