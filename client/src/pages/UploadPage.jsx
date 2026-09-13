import { useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { api } from '../api.js';

const MAX_SIZE = 15 * 1024 * 1024;

export default function UploadPage({ user, onComplete }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [working, setWorking] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  function chooseFile(candidate) {
    setError('');
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith('.pdf')) return setError('Please choose a PDF file.');
    if (candidate.size > MAX_SIZE) return setError('This file is over the 15 MB limit.');
    setFile(candidate);
  }

  async function submit(event) {
    event.preventDefault();
    if (!file) return setError('Choose a PDF before starting analysis.');
    setWorking(true);
    setUploadProgress(0);
    setError('');
    try {
      const blob = await upload(`uploads/${user.id}/${file.name}`, file, {
        access: 'private',
        contentType: 'application/pdf',
        handleUploadUrl: '/api/upload/blob',
        multipart: true,
        onUploadProgress: ({ percentage }) => setUploadProgress(percentage),
      });
      const { note } = await api.post('/api/upload/pdf', { blobUrl: blob.url, originalFilename: file.name });
      onComplete(note);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(false);
    }
  }

  return <section className="upload-page page-width">
    <p className="eyebrow">NOTE ANALYZER</p><h1>Make your notes <span>work harder.</span></h1><p className="page-lede">Upload a text-readable PDF and StudyBot will organize the ideas, add relatable examples, and create practice problems just for you.</p>
    <form onSubmit={submit}>
      <button type="button" className={`dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }}>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" onChange={(event) => chooseFile(event.target.files[0])} hidden />
        <div className="upload-icon">{file ? '✓' : '↥'}</div><h2>{file ? file.name : 'Drop your PDF notes here'}</h2><p>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB — ready to analyze` : 'or click to browse your files'}</p>{file && <span className="replace-file">Choose another file</span>}
      </button>
      <div className="upload-info"><span>◷ Analysis usually takes 30–60 seconds</span><span>◈ Max file size: 15 MB</span><span>⌁ Text-readable PDFs only</span></div>
      {error && <p className="form-error upload-error" role="alert">{error}</p>}
      <button className="primary-button analyze-button" disabled={!file || working}>{working ? <><span className="button-spinner" /> {uploadProgress < 100 ? `Uploading PDF… ${Math.round(uploadProgress)}%` : 'Building your study guide…'}</> : <>Analyze my notes <span>→</span></>}</button>
    </form>
    <div className="analysis-preview"><p className="sidebar-label">YOUR STUDY GUIDE WILL INCLUDE</p><div><span><b>01</b> Topic summaries</span><span><b>02</b> Real-world examples</span><span><b>03</b> Practice & answers</span></div></div>
  </section>;
}
