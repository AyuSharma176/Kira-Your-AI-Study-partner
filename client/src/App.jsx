import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import AuthPage from './pages/AuthPage.jsx';
import WelcomePage from './pages/WelcomePage.jsx';
import ChatPage from './pages/ChatPage.jsx';
import UploadPage from './pages/UploadPage.jsx';
import StudyGuidePage from './pages/StudyGuidePage.jsx';
import Sidebar from './components/Sidebar.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('welcome');
  const [chats, setChats] = useState([]);
  const [notes, setNotes] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeNote, setActiveNote] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const refreshLibrary = useCallback(async () => {
    const [chatData, noteData] = await Promise.all([api.get('/api/chat/history'), api.get('/api/upload/notes')]);
    setChats(chatData.chats);
    setNotes(noteData.notes);
  }, []);

  useEffect(() => {
    api.get('/api/auth/me')
      .then(async ({ user: loggedInUser }) => {
        setUser(loggedInUser);
        await refreshLibrary();
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [refreshLibrary]);

  function navigate(nextPage) {
    setPage(nextPage);
    setSidebarOpen(false);
  }

  async function openChat(chatId) {
    setActiveChatId(chatId);
    navigate('chat');
  }

  function startChat() {
    setActiveChatId(null);
    navigate('chat');
  }

  async function openNote(noteId) {
    try {
      const { note } = await api.get(`/api/upload/notes/${noteId}`);
      setActiveNote(note);
      navigate('guide');
    } catch (error) {
      window.alert(error.message);
    }
  }

  async function reindexActiveNote() {
    if (!activeNote?._id) return;
    const { note } = await api.post(`/api/upload/notes/${activeNote._id}/reindex`, {});
    setActiveNote(note);
    await refreshLibrary();
  }

  async function handleLogout() {
    try { await api.logout(); } catch { /* Cookie may already be gone. */ }
    setUser(null);
    setChats([]);
    setNotes([]);
    setPage('welcome');
  }

  if (loading) return <div className="app-loader"><span className="loader-dot" /> Loading StudyBot</div>;
  if (!user) return <AuthPage onAuthenticated={(loggedInUser) => { setUser(loggedInUser); refreshLibrary(); }} />;

  const activeChat = chats.find((chat) => chat._id === activeChatId) || null;
  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        chats={chats}
        notes={notes}
        currentPage={page}
        activeChatId={activeChatId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNavigate={navigate}
        onNewChat={startChat}
        onOpenChat={openChat}
        onOpenNote={openNote}
        onLogout={handleLogout}
      />
      <main className="main-content">
        <button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">☰</button>
        {page === 'welcome' && <WelcomePage user={user} onDiscuss={startChat} onUpload={() => navigate('upload')} />}
        {page === 'chat' && <ChatPage chat={activeChat} onChatStarted={(id) => setActiveChatId(id)} onHistoryChanged={refreshLibrary} />}
        {page === 'upload' && <UploadPage onComplete={(note) => { setActiveNote(note); refreshLibrary(); navigate('guide'); }} />}
        {page === 'guide' && <StudyGuidePage note={activeNote} onBack={() => navigate('upload')} onReindex={reindexActiveNote} />}
      </main>
    </div>
  );
}
