import mongoose from 'mongoose';

const sourceSchema = new mongoose.Schema(
  {
    noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true },
    chunkId: { type: mongoose.Schema.Types.ObjectId, ref: 'NoteChunk', required: true },
    filename: { type: String, required: true, trim: true },
    excerpt: { type: String, required: true, trim: true, maxlength: 360 },
    score: { type: Number, required: true },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true, trim: true },
    sources: { type: [sourceSchema], default: undefined },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const chatSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'New conversation', trim: true, maxlength: 80 },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

export default mongoose.model('Chat', chatSchema);
