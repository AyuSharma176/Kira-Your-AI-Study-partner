export default function MessageSources({ sources }) {
  if (!Array.isArray(sources) || sources.length === 0) return null;

  return <section className="message-sources" aria-label="From your notes">
    <div className="message-sources-heading"><span>✦ From your notes</span><small>{sources.length} {sources.length === 1 ? 'source' : 'sources'}</small></div>
    <div className="source-list">
      {sources.map((source, index) => <div className="source-card" key={`${source.chunkId}-${index}`}>
        <div className="source-card-top"><strong><span>{index + 1}</span>{source.filename}</strong><small className="source-score">{Math.round(source.score * 100)}% relevant</small></div>
        <p>{source.excerpt}</p>
      </div>)}
    </div>
  </section>;
}
