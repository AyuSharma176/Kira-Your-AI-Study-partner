import { useState } from 'react';
import { api } from '../api.js';

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { email, password } : { name, email, password };
      const { user } = await api.post(path, body);
      onAuthenticated(user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="auth-layout">
    <section className="auth-intro">
      <div className="brand-row"><div className="brand-mark">✦</div><span>StudyBot</span></div>
      <div className="intro-copy"><p className="eyebrow">YOUR LEARNING COMPANION</p><h1>Turn every question into understanding.</h1><p>Chat with a patient AI tutor or turn your class notes into a personal study guide in minutes.</p></div>
      <div className="auth-orbit orbit-one" /><div className="auth-orbit orbit-two" />
      <div className="feature-pills"><span>✦ Clear explanations</span><span>▤ Smart notes</span><span>✓ Practice problems</span></div>
    </section>
    <section className="auth-panel">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-tabs"><button type="button" className={mode === 'login' ? 'chosen' : ''} onClick={() => { setMode('login'); setError(''); }}>Log in</button><button type="button" className={mode === 'register' ? 'chosen' : ''} onClick={() => { setMode('register'); setError(''); }}>Create account</button></div>
        <h2>{mode === 'login' ? 'Welcome back' : 'Start learning smarter'}</h2>
        <p className="auth-subtitle">{mode === 'login' ? 'Continue where you left off.' : 'Your AI study partner is ready.'}</p>
        {mode === 'register' && <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" minLength="2" required autoComplete="name" /></label>}
        <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'} minLength="8" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button auth-submit" disabled={submitting}>{submitting ? 'Just a moment…' : mode === 'login' ? 'Log in →' : 'Create my account →'}</button>
        <p className="privacy-note">Your account stays private. We use secure, httpOnly sessions.</p>
      </form>
    </section>
  </div>;
}
