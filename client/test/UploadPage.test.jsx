/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import UploadPage from '../src/pages/UploadPage.jsx';
import { api } from '../src/api.js';
import { upload } from '@vercel/blob/client';

vi.mock('../src/api.js', () => ({ api: { post: vi.fn() } }));
vi.mock('@vercel/blob/client', () => ({ upload: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('submits the direct-upload Blob URL for PDF analysis', async () => {
  upload.mockResolvedValue({ url: 'https://store.private.blob.vercel-storage.com/uploads/user-a/notes.pdf' });
  api.post.mockResolvedValue({ note: { _id: 'note-1' } });
  const onComplete = vi.fn();
  const user = userEvent.setup();
  const { container } = render(<UploadPage user={{ id: 'user-a' }} onComplete={onComplete} />);
  const input = container.querySelector('input[type="file"]');
  const file = new File(['PDF'], 'notes.pdf', { type: 'application/pdf' });

  await user.upload(input, file);
  await user.click(screen.getByRole('button', { name: /analyze my notes/i }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/upload/pdf', {
    blobUrl: 'https://store.private.blob.vercel-storage.com/uploads/user-a/notes.pdf',
    originalFilename: 'notes.pdf',
  }));
  expect(onComplete).toHaveBeenCalledWith({ _id: 'note-1' });
});
