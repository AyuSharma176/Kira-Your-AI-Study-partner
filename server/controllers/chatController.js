import mongoose from 'mongoose';
import Chat from '../models/Chat.js';
import { streamTutorReply } from '../services/aiService.js';
import { buildRagContext, retrieveRelevantChunks, toSourceRecord } from '../services/ragService.js';

export function createChatController({
  ChatModel = Chat,
  retrieve = retrieveRelevantChunks,
  stream = streamTutorReply,
  logger = console,
} = {}) {
  async function getHistory(req, res, next) {
    try {
      const chats = await ChatModel.find({ userId: req.user._id })
        .sort({ updatedAt: -1 })
        .select('title messages createdAt updatedAt');
      return res.json({ chats });
    } catch (error) {
      return next(error);
    }
  }

  async function sendMessage(req, res, next) {
    let streamStarted = false;
    try {
      const text = req.body.message?.trim();
      const requestedChatId = req.body.chatId;
      if (!text) return res.status(400).json({ message: 'A message is required.' });
      if (text.length > 10000) return res.status(400).json({ message: 'Messages are limited to 10,000 characters.' });

      let chat;
      if (requestedChatId) {
        if (!mongoose.isValidObjectId(requestedChatId)) return res.status(400).json({ message: 'Invalid chat ID.' });
        chat = await ChatModel.findOne({ _id: requestedChatId, userId: req.user._id });
        if (!chat) return res.status(404).json({ message: 'Chat not found.' });
      } else {
        chat = await ChatModel.create({ userId: req.user._id, title: text.slice(0, 60), messages: [] });
      }

      chat.messages.push({ role: 'user', content: text });
      await chat.save();

      let sources = [];
      let ragContext = '';
      try {
        const matches = await retrieve({ userId: req.user._id, question: text });
        sources = matches.map(toSourceRecord);
        ragContext = buildRagContext(matches);
      } catch {
        logger.error('StudyBot RAG retrieval was unavailable; continuing with general chat.');
      }

      res.status(200);
      res.set({
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Chat-Id': String(chat._id),
        'X-RAG-Sources': Buffer.from(JSON.stringify(sources)).toString('base64url'),
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders();
      streamStarted = true;

      let completeReply = '';
      const messageContext = chat.messages.slice(-16).map(({ role, content }) => ({ role, content }));
      for await (const delta of stream(messageContext, ragContext)) {
        completeReply += delta;
        res.write(delta);
      }

      if (completeReply) {
        chat.messages.push({ role: 'assistant', content: completeReply, sources });
        await chat.save();
      }
      return res.end();
    } catch (error) {
      if (streamStarted) {
        res.write(`\n\n[${error.message || 'StudyBot could not finish this response. Please try again.'}]`);
        return res.end();
      }
      return next(error);
    }
  }

  return { getHistory, sendMessage };
}

export const { getHistory, sendMessage } = createChatController();
