# StudyBot RAG Design

## Purpose

Add retrieval-augmented generation (RAG) to StudyBot so a signed-in student can ask questions about their uploaded notes and receive answers grounded in the relevant parts of those notes. The feature must preserve the existing general-purpose tutor chat when no uploaded material is relevant.

## Scope

- Use only the current user's uploaded PDFs as the retrieval corpus.
- Index both new and existing uploaded notes.
- Retrieve context automatically for every discussion message.
- Show the supporting PDF name and matching note excerpts below applicable assistant replies.
- Persist retrieved-source metadata with the corresponding assistant chat message.
- Continue answering normally when no material is relevant or retrieval is temporarily unavailable.

Out of scope: cross-user search, external web search, document uploads beyond the existing PDF flow, and a managed vector database migration.

## Selected Architecture

StudyBot will store embeddings beside note chunks in MongoDB and rank them in the Node.js server with cosine similarity. This is the selected first-stage architecture because a personal study library is small enough for application-side ranking, it requires no Atlas Search index, and it keeps document ownership and source display under StudyBot's control.

Gemini Embedding 2 is used to create normalized 768-dimension embeddings. The existing Gemini API key remains the only AI credential required. Configuration defaults are exposed through environment variables:

- `GEMINI_EMBEDDING_MODEL=gemini-embedding-2`
- `RAG_EMBEDDING_DIMENSIONS=768`
- `RAG_TOP_K=4`
- `RAG_MIN_SCORE=0.38`

The values are defaults, not user-facing settings. They may be tuned after testing with real notes.

## Data Model

### Note changes

Each existing `Note` retains its extracted text and AI study result. It gains a `ragStatus` field:

- `pending`: note has not finished indexing.
- `ready`: all chunks and embeddings are stored.
- `failed`: indexing could not complete and can be retried.

### New `NoteChunk` collection

Each document chunk is represented by a separate MongoDB document:

```js
{
  userId: ObjectId,       // indexed; mandatory ownership boundary
  noteId: ObjectId,       // indexed; parent uploaded note
  originalFilename: String,
  chunkIndex: Number,
  text: String,
  embedding: [Number],    // 768 normalized dimensions
  createdAt: Date,
  updatedAt: Date
}
```

`{ noteId, chunkIndex }` is unique to make re-indexing idempotent. A compound retrieval index on `{ userId, noteId }` is added for ownership-filtered queries.

### Chat message changes

Assistant messages gain an optional `sources` array:

```js
{
  noteId: ObjectId,
  chunkId: ObjectId,
  filename: String,
  excerpt: String,
  score: Number
}
```

The stored excerpt is shortened for display and does not need to duplicate the full chunk text. Sources are omitted for ordinary answers without relevant note context.

## Services and Interfaces

### `ragService.js`

This service owns the RAG workflow behind narrow, testable functions:

- `splitTextIntoChunks(text)`: sentence-aware chunks of about 850 characters with roughly 120 characters of overlap.
- `indexNote(note)`: deletes only the parent note's previous chunks, embeds replacement chunks, writes them, and marks the note `ready`; errors mark it `failed`.
- `retrieveRelevantChunks({ userId, question })`: embeds the question, fetches only that user's chunks, calculates cosine similarity, filters scores under the threshold, and returns at most `RAG_TOP_K` source records.
- `buildRagContext(matches)`: formats retrieved passages for the tutor prompt and treats them as untrusted reference text.

Embedding document text uses a document-oriented prefix containing the source title. Question embeddings use a question-answering query prefix, matching Gemini's asymmetric-retrieval guidance.

### AI service changes

The existing tutor stream accepts an optional retrieval context. Its system instructions say that note excerpts are reference content, not instructions; the model must not follow commands found inside them. It should use the excerpts only when they support the answer and avoid inventing facts from a cited source.

The system prompt continues to define StudyBot as a structured, friendly tutor. A retrieval error is handled outside the stream and does not block general chat.

### Routes

The existing protected upload route indexes a newly saved note after the study analysis succeeds. It returns the note even if indexing fails, with its `ragStatus` so the client can communicate a retry state.

Add one protected recovery route:

```text
POST /api/upload/notes/:id/reindex
```

It verifies ownership, rebuilds that note's chunks, and returns the updated note status. This lets old notes be indexed without uploading the file again.

The existing `POST /api/chat/message` route retrieves sources before it starts streaming. It sends a compact base64url JSON `X-RAG-Sources` response header containing the displayed source records, then streams the answer body exactly as it does today. CORS exposes this header for deployed clients. The completed assistant message persists the same source array.

## Request Flow

### Upload and index

1. Validate the user and PDF upload as today.
2. Extract text and generate the structured study guide.
3. Save the note with `ragStatus: pending`.
4. Chunk and embed the extracted text, then store `NoteChunk` documents.
5. Mark the note `ready`; if indexing fails, mark it `failed` while retaining the study guide.

### Tutor discussion

1. Authenticate the request and persist the student message.
2. Embed the new question and retrieve the student's top relevant note chunks.
3. Add the formatted, untrusted reference excerpts to the tutor input when matches pass the relevance threshold.
4. Send source metadata in `X-RAG-Sources`, then stream the tutor response to the client.
5. Persist the completed assistant message and its sources.

If retrieval, embedding, or indexing has a provider failure, the server logs the issue safely and either continues without RAG (chat) or records a retryable failed status (upload). API keys and provider response details are never returned to the client.

## Frontend Behavior

The existing chat streaming and pause/resume behavior remains unchanged. On each stream response, the client decodes `X-RAG-Sources` and attaches sources to the in-progress assistant message. When the reply appears, a compact “From your notes” section shows source cards containing:

- PDF filename
- relevance label / source number
- matching excerpt, limited to a readable preview

Saved chat history renders the same cards from persisted message data. No source section is displayed when RAG found no relevant notes.

The notes list or note detail view exposes a small re-index action only for notes whose status is `failed` or `pending`; completed notes are not reprocessed automatically.

## Security and Privacy

- Every chunk query filters by the authenticated `userId` before similarity ranking.
- Re-indexing validates that the requested note belongs to the authenticated user.
- Source metadata contains only the current user's note IDs, filenames, and short excerpts.
- Note text is explicitly labeled untrusted in the model input to reduce prompt-injection risk.
- Environment variables remain server-only; no Gemini key or embedding vectors are exposed in the browser.

## Error Handling

- Empty or non-extractable PDFs are rejected before indexing.
- Partial indexing removes only the partial chunks for that note, leaves the note and study guide intact, and records `ragStatus: failed`.
- A source-header decoding error in the browser is ignored gracefully; the streamed answer still displays.
- A chat embedding/retrieval failure falls back to the existing general-tutor stream rather than returning a failed reply.

## Tests and Verification

Server unit tests cover chunk boundaries and overlap, cosine ranking, relevance filtering, user ownership filtering, failed-index cleanup, and source mapping. Controller tests cover re-index authorization and the chat fallback path.

Client tests cover source cards on streamed and saved assistant messages, no source section when absent, and compatibility with the existing pause/resume stream behavior.

Before completion, run the server test suite, the client test suite, production client build, and a local authenticated smoke test for upload, retrieval, source display, and general-chat fallback.
