import fs from 'fs/promises';
import pdf from 'pdf-parse';

export async function extractPdfText(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  const result = await pdf(fileBuffer);
  return result.text.replace(/\s+/g, ' ').trim();
}
