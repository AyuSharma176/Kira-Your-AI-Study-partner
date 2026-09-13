import assert from 'node:assert/strict';
import test from 'node:test';
import { streamTutorReply } from '../services/aiService.js';

test('chat reports a missing Gemini key before making an AI request', async () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const reply = streamTutorReply([{ role: 'user', content: 'Explain gravity.' }]);

  await assert.rejects(reply.next(), {
    message: /GEMINI_API_KEY is not configured/,
  });
});
