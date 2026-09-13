function truncate(value, max = 29) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export default function Sidebar({ user, chats, notes, currentPage, activeChatId, open, onClose, onNavigate, onNewChat, onOpenChat, onOpenNote, onLogout }) {
  return (
    <>
      {open && <button className="sidebar-scrim" onClick={onClose} aria-label="Close navigation" />}
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="brand-row"><div className="brand-mark">✦</div><span className="kira-wordmark">Kira</span><button className="sidebar-close" onClick={onClose}>×</button></div>
        <button className="new-chat" onClick={onNewChat}><span>＋</span> New discussion</button>
        <nav className="mode-nav" aria-label="Main navigation">
          <button className={currentPage === 'welcome' ? 'active' : ''} onClick={() => onNavigate('welcome')}>⌂ <span>Home</span></button>
          <button className={currentPage === 'upload' ? 'active' : ''} onClick={() => onNavigate('upload')}>↥ <span>Analyze notes</span></button>
        </nav>
        <div className="sidebar-list">
          <p className="sidebar-label">Recent discussions</p>
          {chats.length ? chats.map((chat) => <button className={`history-item ${chat._id === activeChatId ? 'selected' : ''}`} onClick={() => onOpenChat(chat._id)} key={chat._id}>◌ <span>{truncate(chat.title)}</span></button>) : <p className="empty-sidebar">Your conversations will appear here.</p>}
          <p className="sidebar-label notes-label">Study guides</p>
          {notes.length ? notes.map((note) => <button className="history-item" onClick={() => onOpenNote(note._id)} key={note._id}>▤ <span>{truncate(note.originalFilename)}</span></button>) : <p className="empty-sidebar">No notes analyzed yet.</p>}
        </div>
        <div className="user-menu"><div className="avatar">{user.name.charAt(0).toUpperCase()}</div><div><strong>{user.name}</strong><small>{user.email}</small></div><button onClick={onLogout} title="Log out" aria-label="Log out">↪</button></div>
      </aside>
    </>
  );
}
