/* @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AuthPage from '../src/pages/AuthPage.jsx';
import Sidebar from '../src/components/Sidebar.jsx';

afterEach(cleanup);

it('uses the Kira wordmark in authentication and app navigation', () => {
  const { unmount } = render(<AuthPage onAuthenticated={vi.fn()} />);
  expect(screen.getByText('Kira').classList.contains('kira-wordmark')).toBe(true);
  unmount();

  render(<Sidebar user={{ name: 'Ada', email: 'ada@example.com' }} chats={[]} notes={[]} currentPage="welcome" activeChatId={null} open={false} onClose={vi.fn()} onNavigate={vi.fn()} onNewChat={vi.fn()} onOpenChat={vi.fn()} onOpenNote={vi.fn()} onLogout={vi.fn()} />);
  expect(screen.getByText('Kira').classList.contains('kira-wordmark')).toBe(true);
});
