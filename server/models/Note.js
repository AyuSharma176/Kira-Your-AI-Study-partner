import mongoose from 'mongoose';

const problemSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
  },
  { _id: false },
);

const exampleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
  },
  { _id: false },
);

const topicSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    summary: { type: String, required: true },
    highlights: { type: [String], default: [] },
    examples: { type: [exampleSchema], default: [] },
    problems: { type: [problemSchema], default: [] },
  },
  { _id: false },
);

const noteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    originalFilename: { type: String, required: true, trim: true },
    extractedText: { type: String, required: true },
    ragStatus: { type: String, enum: ['pending', 'ready', 'failed'], default: 'pending', index: true },
    aiResult: {
      topics: { type: [topicSchema], required: true },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Enforces the per-user duplicate rule even when two uploads arrive together.
noteSchema.index({ userId: 1, originalFilename: 1 }, { unique: true });

export default mongoose.model('Note', noteSchema);
