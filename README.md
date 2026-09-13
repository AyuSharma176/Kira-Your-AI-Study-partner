# KIRA

StudyBot is a full-stack AI study assistant for students. Upload PDF notes to generate structured study material, then discuss a topic with a streaming AI tutor that can automatically use relevant excerpts from your own notes.

## Features

- JWT authentication stored in secure httpOnly cookies
- Password hashing with bcrypt
- PDF note upload, duplicate-file protection, and text extraction with `pdf-parse`
- AI-generated topic summaries, highlights, examples, and practice questions
- ChatGPT-style tutor chat with streamed responses, Markdown formatting, and pause/resume controls
- Personal RAG: automatically retrieves relevant chunks from the signed-in user's notes
- Source cards beneath RAG-backed replies showing the PDF filename and matching excerpt
- Saved chats, study guides, and source metadata in MongoDB
- Responsive dark interface with a StudyBot browser favicon
- Protected Express routes, Helmet security headers, CORS, Morgan request logging, and centralized error handling

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | React 18, Vite, vanilla CSS, React Markdown |
| Backend | Node.js, Express 5 |
| Database | MongoDB with Mongoose |
| Authentication | JSON Web Tokens, httpOnly cookies, bcryptjs |
| AI | Google Gemini via `@google/genai` |
| Retrieval | Gemini Embedding 2, MongoDB note chunks, cosine similarity |
| PDF handling | Vercel Blob and pdf-parse |
| Testing | Node test runner, Vitest, Testing Library |

## Project structure

```text
studybot/
├── client/                 # React and Vite application
│   ├── public/             # Browser icon and static assets
│   ├── src/                # Pages, components, API helpers, and styles
│   └── test/               # Client tests
├── server/                 # Express API
│   ├── config/             # MongoDB connection
│   ├── controllers/        # Auth, chat, and upload request handlers
│   ├── middleware/         # Authentication, upload, and error middleware
│   ├── models/             # User, Chat, Note, and NoteChunk schemas
│   ├── routes/             # API route definitions
│   ├── services/           # Gemini, PDF, and RAG services
│   └── test/               # Server tests
├── docs/                   # RAG design and implementation documents
├── package.json            # Root development scripts
└── README.md
```

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- A MongoDB database, either local or MongoDB Atlas
- A Google AI Studio Gemini API key with access to the configured chat and embedding models

## Quick start

1. Clone your GitHub repository after you create it.

   ```bash
   git clone https://github.com/YOUR_USERNAME/studybot.git
   cd studybot
   ```

2. Install all workspace dependencies.

   ```bash
   npm run install:all
   ```

3. Copy the safe environment template.

   ```bash
   copy server\.env.example server\.env
   ```

   On macOS or Linux, use:

   ```bash
   cp server/.env.example server/.env
   ```

4. Edit `server/.env` and add your MongoDB connection string, JWT secret, and Gemini API key. Do not commit this file.

5. Start the client and API together.

   ```bash
   npm run dev
   ```

6. Open [http://localhost:5173](http://localhost:5173).

The Express API runs on `http://localhost:5000`. Vite proxies browser requests beginning with `/api` to that server in development.

## Environment variables

Use [`server/.env.example`](server/.env.example) as the source of truth. The following values are required or commonly configured:

```dotenv
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

MONGO_URI=mongodb://localhost:27017/studybot
MONGO_DNS_SERVER=8.8.8.8

JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.6-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
RAG_EMBEDDING_DIMENSIONS=768
RAG_TOP_K=4
RAG_MIN_SCORE=0.38
```

`GEMINI_API_KEY` is read only by the Express server. It is used for both tutor responses and note embeddings, and it is never sent to the browser.

`BLOB_READ_WRITE_TOKEN` is required in Vercel. It authorizes the server to issue authenticated direct-upload tokens and retrieve private PDFs while they are analyzed. It is never sent to the browser.

## Deploy to Vercel

This repository deploys as one Vercel project: Vite builds the React client and `api/index.js` runs the Express API as a Node.js Function. PDFs are uploaded directly from the browser to a **private** Vercel Blob store, so the API does not receive the file body and is not limited by Vercel Function request size.

1. Push the `codex/deployable` branch to GitHub and import the repository into Vercel. Leave the project root as the repository root; `vercel.json` supplies the build command and `client/dist` output directory.
2. In **Storage**, create a new **Vercel Blob** store with access set to **Private** and connect it to the project. Vercel adds `BLOB_READ_WRITE_TOKEN` to the selected environments.
3. In **Settings → Environment Variables**, set these for Preview and Production:

   ```dotenv
   NODE_ENV=production
   CLIENT_URL=https://your-project.vercel.app
   MONGO_URI=your-mongodb-atlas-connection-string
   JWT_SECRET=a-long-random-secret
   JWT_EXPIRES_IN=7d
   GEMINI_API_KEY=your-google-ai-studio-key
   GEMINI_MODEL=gemini-3.6-flash
   GEMINI_EMBEDDING_MODEL=gemini-embedding-2
   RAG_EMBEDDING_DIMENSIONS=768
   RAG_TOP_K=4
   RAG_MIN_SCORE=0.38
   ```

   `BLOB_READ_WRITE_TOKEN` is supplied automatically when the private Blob store is connected. Do not add it to client-side `VITE_*` variables.
4. In MongoDB Atlas, create a database user for this application and allow Vercel network access. For a quick development deployment, Atlas's `0.0.0.0/0` access rule works; restrict it further when you have a suitable network boundary.
5. Deploy from the Vercel dashboard or run `npx vercel --prod` after logging into the Vercel CLI. Set `CLIENT_URL` again to the final custom domain if you add one, then redeploy.

The deployment uses same-origin `/api` requests and secure httpOnly cookies, so no separate frontend API URL is necessary. Vercel Function duration is set to 300 seconds to accommodate PDF extraction and Gemini analysis.

## How RAG works

When a note is analyzed, StudyBot splits the extracted text into overlapping, sentence-aware chunks. Each chunk receives a 768-dimension Gemini embedding and is stored in MongoDB with the owning user and note.

For every discussion message, StudyBot embeds the question, fetches only the signed-in user's chunks, ranks them with cosine similarity, and adds the most relevant excerpts to the tutor's context. The chat response streams as normal, while the browser displays a **From your notes** card with the PDF filename and excerpt.

RAG is designed to fail safely:

- If no note is relevant, StudyBot gives a normal tutor response.
- If retrieval is temporarily unavailable, the general tutor chat continues.
- If indexing fails after a PDF analysis, the study guide is preserved and the user can retry indexing from the guide page.
- Note chunks are indexed one at a time to avoid request bursts on Gemini's free tier.
- Users can only retrieve their own uploaded notes.

## API routes

All chat and upload routes require an authenticated session.

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create a user account and start a session |
| `POST` | `/api/auth/login` | Sign in and start a session |
| `POST` | `/api/auth/logout` | End the current session |
| `GET` | `/api/auth/me` | Get the current user |
| `GET` | `/api/chat/history` | Get the user's saved discussions |
| `POST` | `/api/chat/message` | Stream a tutor response; includes RAG source metadata when relevant |
| `POST` | `/api/upload/pdf` | Upload, analyze, and index a PDF |
| `GET` | `/api/upload/notes` | List the user's study guides |
| `GET` | `/api/upload/notes/:id` | Get one study guide |
| `POST` | `/api/upload/notes/:id/reindex` | Rebuild the RAG index for one owned note |
| `GET` | `/api/health` | API health check |

## Available scripts

| Command | Description |
| --- | --- |
| `npm run install:all` | Install root, server, and client dependencies |
| `npm run dev` | Start the Express API and Vite client together |
| `npm run server` | Start only the Express API in watch mode |
| `npm run client` | Start only the Vite client |
| `npm run build --prefix client` | Build the production React bundle |
| `npm run test --prefix server` | Run server tests |
| `npm run test --prefix client` | Run client tests |

## Testing

Run the complete verification set before opening a pull request or pushing a release:

```bash
npm run test --prefix server
npm run test --prefix client
npm run build --prefix client
```

The tests cover RAG chunking, ranking, user ownership filtering, indexing cleanup, chat fallback behavior, streamed source cards, saved source cards, Markdown output, and pause/resume behavior.

## Notes about handwritten PDFs

StudyBot currently uses `pdf-parse`, which extracts text embedded in a PDF. Image-only scanned handwriting must first have an OCR text layer; otherwise, the upload route returns a clear message instead of generating an unreliable guide.

## GitHub push checklist

Before you push this project:

1. Confirm `server/.env` is never staged or uploaded.
2. Keep `server/.env.example` as the safe configuration template.
3. Do not push `node_modules`, `dist`, logs, or uploaded PDFs.
4. Run the three verification commands above.
5. Create your repository, then run:

   ```bash
   git init
   git add .
   git commit -m "Initial StudyBot release"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
   git push -u origin main
   ```

Replace the placeholder GitHub URL with your own repository URL. If you accidentally exposed a real API key in any public location, rotate that key before pushing.

## Security notes

- Secrets belong only in `server/.env`, which is ignored by Git.
- Passwords are hashed before storage.
- Authentication uses signed JWTs stored in httpOnly cookies.
- Every protected route verifies the current user.
- RAG queries are always filtered by the current user's ID before similarity ranking.
- Retrieved note text is treated as untrusted reference content rather than model instructions.
