export default function WelcomePage({ user, onDiscuss, onUpload }) {
  return <section className="welcome-page page-width">
    <div className="welcome-spark">✦</div>
    <p className="eyebrow">STUDYBOT IS READY</p>
    <h1>Hi {user.name.split(' ')[0]}! <span>How can I help you today?</span></h1>
    <p className="welcome-description">I can be your patient study partner — ask anything, or transform your notes into a clear study plan.</p>
    <div className="welcome-options">
      <button className="option-card notes-option" onClick={onUpload}><div className="option-icon">▤</div><div><h2>Upload PDF notes</h2><p>Get summaries, examples, and practice questions from your notes.</p></div><span className="option-arrow">→</span></button>
      <button className="option-card discuss-option" onClick={onDiscuss}><div className="option-icon">✦</div><div><h2>Discuss a topic</h2><p>Ask a question and learn through a natural conversation.</p></div><span className="option-arrow">→</span></button>
    </div>
    <div className="suggestion-row"><span>Try asking</span><button onClick={onDiscuss}>“Explain photosynthesis simply”</button><button onClick={onDiscuss}>“Help me prepare for an exam”</button></div>
  </section>;
}
