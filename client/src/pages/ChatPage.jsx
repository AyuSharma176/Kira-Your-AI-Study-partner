import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MessageSources from '../components/MessageSources.jsx';
import { decodeRagSources } from '../ragSources.js';

function initialMessages(chat) {
  return chat?.messages || [];
}

export default function ChatPage({ chat, onChatStarted, onHistoryChanged }) {
  const [messages, setMessages] = useState(() => initialMessages(chat));
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const chatIdRef = useRef(chat?._id || null);
  const pausedRef = useRef(false);
  const displayedReplyRef = useRef('');
  const bufferedReplyRef = useRef('');

  useEffect(() => {
    chatIdRef.current = chat?._id || null;
    setMessages(initialMessages(chat));
    setError('');
    pausedRef.current = false;
    displayedReplyRef.current = '';
    bufferedReplyRef.current = '';
    setPaused(false);
  }, [chat?._id]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming, paused]);

  function setAssistantContent(content) {
    setMessages((previous) => {
      const lastMessage = previous.at(-1);
      if (!lastMessage || lastMessage.role !== 'assistant') return previous;
      return [...previous.slice(0, -1), { ...lastMessage, content }];
    });
  }

  function setAssistantSources(sources) {
    setMessages((previous) => {
      const lastMessage = previous.at(-1);
      if (!lastMessage || lastMessage.role !== 'assistant') return previous;
      return [...previous.slice(0, -1), { ...lastMessage, sources }];
    });
  }

  function appendVisibleText(text) {
    displayedReplyRef.current += text;
    setAssistantContent(displayedReplyRef.current);
  }

  function togglePause() {
    if (pausedRef.current) {
      pausedRef.current = false;
      setPaused(false);
      if (bufferedReplyRef.current) {
        appendVisibleText(bufferedReplyRef.current);
        bufferedReplyRef.current = '';
      }
      return;
    }

    pausedRef.current = true;
    setPaused(true);
  }

  async function sendMessage(event) {
    event?.preventDefault();
    const message = input.trim();
    if (!message || streaming || paused) return;
    setInput('');
    setError('');
    setMessages((previous) => [...previous, { role: 'user', content: message }, { role: 'assistant', content: '' }]);
    displayedReplyRef.current = '';
    bufferedReplyRef.current = '';
    pausedRef.current = false;
    setPaused(false);
    setStreaming(true);
    try {
      const response = await fetch('/api/chat/message', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, chatId: chatIdRef.current }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Unable to send your message.');
      }
      const newChatId = response.headers.get('X-Chat-Id');
      if (newChatId && !chatIdRef.current) { chatIdRef.current = newChatId; onChatStarted(newChatId); }
      setAssistantSources(decodeRagSources(response.headers.get('X-RAG-Sources')));
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullReply = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullReply += chunk;
        if (pausedRef.current) bufferedReplyRef.current += chunk;
        else appendVisibleText(chunk);
      }
      const remaining = decoder.decode();
      fullReply += remaining;
      if (remaining) {
        if (pausedRef.current) bufferedReplyRef.current += remaining;
        else appendVisibleText(remaining);
      }
      if (fullReply.startsWith('\n\n[') && fullReply.endsWith(']')) throw new Error(fullReply.slice(2, -1));
      if (!fullReply.trim()) throw new Error('The AI returned an empty response. Please try again.');
      await onHistoryChanged();
    } catch (requestError) {
      setMessages((previous) => {
        const lastIndex = previous.length - 1;
        return previous.filter((item, index) => !(index === lastIndex && item.role === 'assistant'));
      });
      setError(requestError.message);
    } finally {
      setStreaming(false);
    }
  }

  const isEmpty = messages.length === 0;
  const replyInProgress = streaming || paused;
  return <section className="chat-page">
    <div className={`chat-scroll ${isEmpty ? 'chat-empty' : ''}`}>
      {isEmpty && <div className="chat-blank-state"><div className="chat-blank-icon">✦</div><h1>What would you like to learn?</h1><p>I’m StudyBot, your smart and encouraging AI tutor.</p><div className="quick-prompts"><button onClick={() => setInput('Explain this topic in simple terms: ')}>Explain a topic simply</button><button onClick={() => setInput('Create a study plan for ')}>Make a study plan</button><button onClick={() => setInput('Quiz me on ')}>Quiz me on a subject</button></div></div>}
      {!isEmpty && <div className="messages">{messages.map((item, index) => <article className={`message ${item.role}`} key={`${item.role}-${index}`}><div className="message-avatar">{item.role === 'assistant' ? '✦' : 'You'}</div><div className="message-body">{item.role === 'assistant' ? <>{item.content ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown> : (streaming && (paused ? <span className="reply-paused">Reply paused — new text is safely buffered.</span> : <span className="typing-indicator"><i /><i /><i /></span>))}<MessageSources sources={item.sources} /></> : item.content}</div></article>)}</div>}
      <div ref={endRef} />
    </div>
    <div className="chat-composer-wrap"><form className="chat-composer" onSubmit={sendMessage}><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Ask anything…" rows="1" disabled={replyInProgress} /><div className="composer-actions">{replyInProgress && <button type="button" className={`pause-button ${paused ? 'is-paused' : ''}`} onClick={togglePause} aria-label={paused ? 'Resume response' : 'Pause response'}>{paused ? '▶ Resume' : 'Ⅱ Pause'}</button>}<button className="send-button" disabled={!input.trim() || replyInProgress} aria-label="Send message">↑</button></div></form>{error && <p className="form-error chat-error">{error}</p>}<p className="composer-caption">StudyBot can make mistakes. Check important information.</p></div>
  </section>;
}
