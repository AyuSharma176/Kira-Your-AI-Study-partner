import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const uploadDirectory = path.resolve(currentDir, '../uploads');

const storage = multer.diskStorage({
  destination: uploadDirectory,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
});

const pdfOnly = (req, file, cb) => {
  if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) return cb(null, true);
  return cb(new Error('Only PDF files can be uploaded.'));
};

export const uploadPdf = multer({
  storage,
  fileFilter: pdfOnly,
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
}).single('pdf');
