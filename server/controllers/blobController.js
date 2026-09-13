import { handleUpload } from '@vercel/blob/client';

const MAX_PDF_SIZE = 15 * 1024 * 1024;
const TOKEN_LIFETIME_MS = 15 * 60 * 1000;

export function createBlobController({ handleClientUpload = handleUpload } = {}) {
  async function handleClientUploadRequest(req, res, next) {
    try {
      const response = await handleClientUpload({
        body: req.body,
        request: req,
        onBeforeGenerateToken: async (pathname) => {
          const expectedPrefix = `uploads/${req.user._id}/`;
          if (!pathname.startsWith(expectedPrefix)) {
            throw new Error('The requested Blob path is not an authorized upload path.');
          }

          return {
            allowedContentTypes: ['application/pdf'],
            maximumSizeInBytes: MAX_PDF_SIZE,
            addRandomSuffix: true,
            validUntil: Date.now() + TOKEN_LIFETIME_MS,
            tokenPayload: JSON.stringify({ userId: req.user._id }),
          };
        },
        onUploadCompleted: async () => {},
      });
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  return { handleClientUploadRequest };
}

export const { handleClientUploadRequest } = createBlobController();
