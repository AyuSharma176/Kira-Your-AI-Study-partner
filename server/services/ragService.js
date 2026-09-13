import NoteChunk from '../models/NoteChunk.js';
import { embedText } from './aiService.js';

const DEFAULT_TARGET_SIZE = 850;
const DEFAULT_OVERLAP_SIZE = 120;
const DEFAULT_TOP_K = 4;
const DEFAULT_MIN_SCORE = 0.38;
const SOURCE_EXCERPT_LENGTH = 320;

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveTargetSize(value) {
  return Math.floor(positiveNumber(value, DEFAULT_TARGET_SIZE));
}

function resolveOverlapSize(value, targetSize) {
  return Math.min(Math.floor(positiveNumber(value, DEFAULT_OVERLAP_SIZE)), targetSize - 1);
}

function resolveTopK(value) {
  return Math.floor(positiveNumber(value ?? process.env.RAG_TOP_K, DEFAULT_TOP_K));
}

function resolveMinScore(value) {
  const parsed = Number(value ?? process.env.RAG_MIN_SCORE);
  return Number.isFinite(parsed) ? parsed : DEFAULT_MIN_SCORE;
}

function sentenceList(text) {
  return text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [];
}

function trailingOverlap(text, overlapSize) {
  if (text.length <= overlapSize) return text;

  const sentences = sentenceList(text);
  let overlap = '';
  for (let index = sentences.length - 1; index >= 0; index -= 1) {
    const candidate = overlap ? `${sentences[index]} ${overlap}` : sentences[index];
    if (candidate.length > overlapSize && overlap) break;
    overlap = candidate;
    if (overlap.length >= overlapSize) break;
  }
  return overlap || text.slice(-overlapSize).trim();
}

function splitLongSentence(sentence, targetSize, overlapSize) {
  const chunks = [];
  const step = Math.max(1, targetSize - overlapSize);
  for (let start = 0; start < sentence.length; start += step) {
    chunks.push(sentence.slice(start, start + targetSize).trim());
    if (start + targetSize >= sentence.length) break;
  }
  return chunks;
}

/** Split normalized text into sentence-aware, overlapping chunks for embedding. */
export function splitTextIntoChunks(text, options = {}) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const targetSize = resolveTargetSize(options.targetSize);
  const overlapSize = resolveOverlapSize(options.overlapSize, targetSize);
  const chunks = [];
  let current = '';

  for (const sentence of sentenceList(normalized)) {
    if (sentence.length > targetSize) {
      if (current) chunks.push(current);
      chunks.push(...splitLongSentence(sentence, targetSize, overlapSize));
      current = '';
      continue;
    }

    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= targetSize) {
      current = candidate;
      continue;
    }

    chunks.push(current);
    current = `${trailingOverlap(current, overlapSize)} ${sentence}`.trim();
  }

  if (current) chunks.push(current);
  return chunks.map((chunk, chunkIndex) => ({ chunkIndex, text: chunk }));
}

/** Return cosine similarity in [-1, 1], or zero for unusable vectors. */
export function cosineSimilarity(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length === 0 || left.length !== right.length) return 0;

  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = Number(left[index]);
    const rightValue = Number(right[index]);
    if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) return 0;
    dotProduct += leftValue * rightValue;
    leftMagnitude += leftValue ** 2;
    rightMagnitude += rightValue ** 2;
  }

  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator ? dotProduct / denominator : 0;
}

/** Score, filter, and order chunks without mutating the input collection. */
export function rankRelevantChunks(queryEmbedding, chunks, options = {}) {
  const minScore = resolveMinScore(options.minScore);
  const topK = resolveTopK(options.topK);
  return (Array.isArray(chunks) ? chunks : [])
    .map((chunk) => ({ ...chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .filter((chunk) => chunk.score >= minScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);
}

export function toSourceRecord(match) {
  const normalizedText = String(match.text || '').replace(/\s+/g, ' ').trim();
  const excerpt = normalizedText.length > SOURCE_EXCERPT_LENGTH
    ? `${normalizedText.slice(0, SOURCE_EXCERPT_LENGTH - 1).trimEnd()}…`
    : normalizedText;

  return {
    noteId: String(match.noteId),
    chunkId: String(match._id),
    filename: String(match.originalFilename || 'Uploaded notes'),
    excerpt,
    score: Number(match.score.toFixed(4)),
  };
}

/** Build an explicit boundary around note excerpts before sending them to the tutor. */
export function buildRagContext(matches) {
  if (!Array.isArray(matches) || matches.length === 0) return '';

  const passages = matches.map((match, index) => (
    `[Source ${index + 1}: ${match.originalFilename || 'Uploaded notes'}]\n${match.text}`
  )).join('\n\n');

  return `UNTRUSTED REFERENCE MATERIAL FROM THE STUDENT'S NOTES\n${passages}\nEND UNTRUSTED REFERENCE MATERIAL`;
}

/** Replace the chunks for a single note and retain a retryable failure state. */
export async function indexNote(note, { NoteChunkModel = NoteChunk, embedText: embed = embedText } = {}) {
  const chunks = splitTextIntoChunks(note.extractedText);
  note.ragStatus = 'pending';
  await note.save();
  await NoteChunkModel.deleteMany({ noteId: note._id });

  try {
    if (chunks.length === 0) throw new Error('The note does not contain text that can be indexed.');

    const records = [];
    for (const { chunkIndex, text } of chunks) {
      records.push({
        userId: note.userId,
        noteId: note._id,
        originalFilename: note.originalFilename,
        chunkIndex,
        text,
        embedding: await embed(text, 'document'),
      });
    }
    await NoteChunkModel.insertMany(records);
    note.ragStatus = 'ready';
    await note.save();
    return note;
  } catch (error) {
    await NoteChunkModel.deleteMany({ noteId: note._id });
    note.ragStatus = 'failed';
    await note.save();
    throw error;
  }
}

/** Return full scored chunks so callers can build context and compact source cards. */
export async function retrieveRelevantChunks(
  { userId, question },
  { NoteChunkModel = NoteChunk, embedText: embed = embedText } = {},
) {
  const [queryEmbedding, chunks] = await Promise.all([
    embed(question, 'query'),
    NoteChunkModel.find({ userId }).lean(),
  ]);
  return rankRelevantChunks(queryEmbedding, chunks);
}
