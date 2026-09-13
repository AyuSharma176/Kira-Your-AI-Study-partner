import mongoose from 'mongoose';

const noteChunkSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true, index: true },
    originalFilename: { type: String, required: true, trim: true },
    chunkIndex: { type: Number, required: true, min: 0 },
    text: { type: String, required: true, trim: true },
    embedding: { type: [Number], required: true },
  },
  { timestamps: true },
);

noteChunkSchema.index({ noteId: 1, chunkIndex: 1 }, { unique: true });
noteChunkSchema.index({ userId: 1, noteId: 1 });

export default mongoose.model('NoteChunk', noteChunkSchema);
