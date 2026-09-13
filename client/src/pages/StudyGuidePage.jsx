import { useState } from 'react';

export default function StudyGuidePage({ note, onBack, onReindex }) {
  const [openProblem, setOpenProblem] = useState(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexError, setReindexError] = useState('');
  if (!note) return <section className="empty-guide page-width"><h1>No study guide selected.</h1><button className="primary-button" onClick={onBack}>Analyze some notes</button></section>;
  const topics = note.aiResult?.topics || [];
  const ragStatus = note.ragStatus || 'pending';

  async function retryIndex() {
    if (!onReindex || reindexing) return;
    setReindexing(true);
    setReindexError('');
    try {
      await onReindex();
    } catch (error) {
      setReindexError(error.message || 'Could not index this note. Please try again.');
    } finally {
      setReindexing(false);
    }
  }
  return <section className="guide-page page-width">
    <button className="back-button" onClick={onBack}>← Back to notes</button>
    <div className="guide-hero"><div><p className="eyebrow">YOUR STUDY GUIDE</p><h1>{note.originalFilename}</h1><p>Built around {topics.length} {topics.length === 1 ? 'topic' : 'topics'} from your notes.</p><div className={`rag-status ${ragStatus}`}><span>{ragStatus === 'ready' ? '✓ Ready for note-aware chat' : ragStatus === 'failed' ? 'RAG indexing needs another try' : 'Preparing this note for chat'}</span>{ragStatus !== 'ready' && onReindex && <button className="rag-retry" onClick={retryIndex} disabled={reindexing}>{reindexing ? 'Indexing…' : 'Retry indexing'}</button>}</div>{reindexError && <p className="rag-error" role="alert">{reindexError}</p>}</div><div className="guide-badge">✦<span>AI organized</span></div></div>
    <div className="topic-jump"><span>Jump to</span>{topics.map((topic, index) => <a href={`#topic-${index}`} key={topic.title}>{index + 1}. {topic.title}</a>)}</div>
    <div className="topics-stack">{topics.map((topic, topicIndex) => <article id={`topic-${topicIndex}`} className="topic-card" key={`${topic.title}-${topicIndex}`}>
      <div className="topic-number">{String(topicIndex + 1).padStart(2, '0')}</div><div className="topic-heading"><h2>{topic.title}</h2><p>{topic.summary}</p></div>
      <section className="guide-section highlights"><h3><span>✦</span> Key highlights</h3><ul>{topic.highlights.map((highlight, index) => <li key={index}>{highlight}</li>)}</ul></section>
      <section className="guide-section examples"><h3><span>◈</span> See it in the real world</h3><div className="examples-grid">{topic.examples.map((example, index) => <div className="example-card" key={index}><strong>{example.title}</strong><p>{example.description}</p></div>)}</div></section>
      <section className="guide-section practice"><h3><span>✎</span> Practice yourself</h3><div className="problems-list">{topic.problems.map((problem, index) => { const key = `${topicIndex}-${index}`; const opened = openProblem === key; return <div className="problem-card" key={key}><div><b>{index + 1}</b><p>{problem.question}</p></div><button onClick={() => setOpenProblem(opened ? null : key)}>{opened ? 'Hide answer' : 'Show answer'}</button>{opened && <div className="answer"><strong>Answer</strong><p>{problem.answer}</p></div>}</div>; })}</div></section>
    </article>)}</div>
  </section>;
}
