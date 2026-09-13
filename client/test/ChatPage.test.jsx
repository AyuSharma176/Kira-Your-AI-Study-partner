/* @vitest-environment jsdom */
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatPage from '../src/pages/ChatPage.jsx';

const encoder = new TextEncoder();
const source = {
  noteId: 'note-1',
  chunkId: 'chunk-1',
  filename: 'biology.pdf',
  excerpt: 'Chlorophyll captures sunlight for photosynthesis.',
  score: 0.82,
};

function toBase64Url(value) {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createStreamingResponse(sources = []) {
  let controller;
  const body = new ReadableStream({
    start(nextController) {
      controller = nextController;
    },
  });

  return {
    response: { ok: true, headers: new Headers({ 'X-Chat-Id': 'test-chat', 'X-RAG-Sources': toBase64Url(sources) }), body },
    write(text) { controller.enqueue(encoder.encode(text)); },
    finish() { controller.close(); },
  };
}

async function startStreamingReply(stream) {
  globalThis.fetch = vi.fn().mockResolvedValue(stream.response);
  const user = userEvent.setup();
  render(<ChatPage chat={null} onChatStarted={vi.fn()} onHistoryChanged={vi.fn()} />);
  await user.type(screen.getByPlaceholderText('Ask anything…'), 'Create a study plan');
  await user.click(screen.getByRole('button', { name: 'Send message' }));
  return user;
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ChatPage', () => {
  it('shows a Pause response control while an AI reply is streaming', async () => {
    const stream = createStreamingResponse();

    try {
      await startStreamingReply(stream);
      expect(await screen.findByRole('button', { name: 'Pause response' })).toBeTruthy();
    } finally {
      stream.finish();
    }
  });

  it('buffers streamed text until the user resumes the reply', async () => {
    const stream = createStreamingResponse();

    try {
      const user = await startStreamingReply(stream);
      await user.click(await screen.findByRole('button', { name: 'Pause response' }));

      act(() => stream.write('**Buffered lesson**'));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(screen.queryByText('Buffered lesson')).toBeNull();

      await user.click(screen.getByRole('button', { name: 'Resume response' }));
      expect(await screen.findByText('Buffered lesson')).toBeTruthy();
    } finally {
      stream.finish();
    }
  });

  it('renders assistant Markdown as structured content', () => {
    render(<ChatPage chat={{ _id: 'saved-chat', messages: [{ role: 'assistant', content: '## Weekly roadmap\n\n**Focus**\n\n- Arrays\n- Strings' }] }} onChatStarted={vi.fn()} onHistoryChanged={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Weekly roadmap' })).toBeTruthy();
    expect(screen.getByText('Focus').tagName).toBe('STRONG');
    expect(screen.getByRole('list')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'From your notes' })).toBeNull();
  });

  it('shows source cards from the RAG stream header', async () => {
    const stream = createStreamingResponse([source]);

    try {
      await startStreamingReply(stream);
      act(() => stream.write('Photosynthesis uses light.'));
      expect(await screen.findByRole('region', { name: 'From your notes' })).toBeTruthy();
      expect(screen.getByText('biology.pdf')).toBeTruthy();
      expect(screen.getByText(source.excerpt)).toBeTruthy();
    } finally {
      stream.finish();
    }
  });

  it('shows persisted source cards when a saved discussion is reopened', () => {
    render(<ChatPage chat={{ _id: 'saved-chat', messages: [{ role: 'assistant', content: 'A saved answer.', sources: [source] }] }} onChatStarted={vi.fn()} onHistoryChanged={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'From your notes' })).toBeTruthy();
    expect(screen.getByText('biology.pdf')).toBeTruthy();
  });
});
