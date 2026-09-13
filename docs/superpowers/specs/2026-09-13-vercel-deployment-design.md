# StudyBot Vercel deployment design

## Goal

Deploy the React client and Express API together as one Vercel project while preserving authenticated chat, streamed tutor responses, MongoDB persistence, and PDF uploads up to 15 MB.

## Architecture

Vercel serves the built Vite application as static output and invokes Express through a Node.js function for `/api/*`. The Express application is separated from the local development listener: a shared app module configures routes and middleware, while the local server entry point alone calls `listen`.

The browser continues to call same-origin `/api/*` endpoints, so production does not require cross-origin cookies or a separate API URL. The Vite development proxy remains unchanged.

MongoDB Atlas remains the durable datastore. The deployed function runs in the region closest to the MongoDB deployment where Vercel supports that region.

## PDF upload flow

1. The authenticated browser requests a short-lived, user-scoped Vercel Blob client-upload token from the API.
2. The browser uploads the PDF directly to a private Vercel Blob path.
3. The browser submits its Blob URL and original filename to the existing upload endpoint.
4. The API validates the Blob URL and filename, downloads the PDF into the function's temporary directory, extracts text, analyzes it, and indexes it.
5. The API deletes the temporary file and Blob object regardless of successful analysis. Study-guide data remains stored in MongoDB as it is today.

This removes the current dependency on `server/uploads`, which is not durable on Vercel, and keeps upload bytes out of the Vercel Function request body.

## Security and validation

Client upload tokens are limited to the authenticated user's generated Blob pathname and PDFs only. The API verifies that a submitted Blob belongs to the expected private Blob store and pathname format before fetching it. It retains the existing 15 MB file-size limit and validates PDFs by filename/content type at the upload boundary.

Cookies remain `httpOnly`; their `secure` setting is enabled in production. The API's CORS origin is configured from `CLIENT_URL`, with credentials enabled. Vercel environment variables store `MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `BLOB_READ_WRITE_TOKEN`, and the existing optional AI/RAG settings; no secret is committed.

## Runtime and failures

The API function has an explicit maximum duration appropriate for PDF extraction and Gemini analysis. Chat response streaming remains an Express streaming response. The upload handler always attempts cleanup after processing; user-facing errors remain centralized through the existing error middleware.

## Files and verification

Implementation will add Vercel configuration, split Express app setup from local startup, replace disk-backed Multer upload handling with the direct-Blob flow, update client upload behavior, add deployment documentation and environment examples, and add tests for Blob URL/token validation and cleanup behavior.

Verification will run server tests, client tests, and the production client build. Deployment documentation will include the Vercel dashboard settings that cannot be committed, including connecting MongoDB Atlas and a private Blob store.
