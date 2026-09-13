import mongoose from 'mongoose';
import Note from '../models/Note.js';
import { deletePdf, downloadPdf, isOwnedPrivateBlobUrl } from '../services/blobService.js';
import { extractPdfText } from '../services/pdfService.js';
import { analyzeNotes } from '../services/aiService.js';
import { indexNote } from '../services/ragService.js';

export function createUploadController({
  NoteModel = Note,
  extractPdf = extractPdfText,
  analyze = analyzeNotes,
  index = indexNote,
  downloadPdf: download = downloadPdf,
  deletePdf: removeBlob = deletePdf,
} = {}) {
  async function uploadAndAnalyze(req, res, next) {
    let uploadedPdf;
    try {
      const { blobUrl, originalFilename } = req.body || {};
      if (!blobUrl || !originalFilename?.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ message: 'Choose a PDF file to upload.' });
      }
      if (!isOwnedPrivateBlobUrl(blobUrl, req.user._id)) {
        return res.status(400).json({ message: 'The uploaded PDF could not be verified.' });
      }

      const duplicate = await NoteModel.findOne({ userId: req.user._id, originalFilename });
      if (duplicate) {
        await removeBlob(blobUrl).catch(() => {});
        return res.status(409).json({ message: 'This PDF has already been analyzed.', noteId: duplicate._id });
      }

      uploadedPdf = await download(blobUrl);
      const extractedText = await extractPdf(uploadedPdf.path);
      if (extractedText.length < 30) {
        return res.status(422).json({ message: 'No readable text was found. This PDF may need OCR before it can be analyzed.' });
      }

      const aiResult = await analyze(extractedText);
      const note = await NoteModel.create({
        userId: req.user._id,
        originalFilename,
        extractedText,
        aiResult,
      });

      try {
        await index(note);
      } catch (error) {
        console.error(`Could not index note for RAG: ${error.message}`);
      }

      return res.status(201).json({ note });
    } catch (error) {
      return next(error);
    } finally {
      await uploadedPdf?.cleanup?.();
    }
  }

  async function getNotes(req, res, next) {
    try {
      const notes = await NoteModel.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .select('originalFilename aiResult.topics.title ragStatus createdAt');
      return res.json({ notes });
    } catch (error) {
      return next(error);
    }
  }

  async function getNote(req, res, next) {
    try {
      const note = await NoteModel.findOne({ _id: req.params.id, userId: req.user._id });
      if (!note) return res.status(404).json({ message: 'Study guide not found.' });
      return res.json({ note });
    } catch (error) {
      return next(error);
    }
  }

  async function reindexNote(req, res, next) {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Study guide not found.' });
      const note = await NoteModel.findOne({ _id: req.params.id, userId: req.user._id });
      if (!note) return res.status(404).json({ message: 'Study guide not found.' });
      await index(note);
      return res.json({ note });
    } catch (error) {
      return next(error);
    }
  }

  return { uploadAndAnalyze, getNotes, getNote, reindexNote };
}

export const { uploadAndAnalyze, getNotes, getNote, reindexNote } = createUploadController();
