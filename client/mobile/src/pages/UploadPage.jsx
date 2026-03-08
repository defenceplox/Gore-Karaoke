import { useState, useRef } from 'react';
import theme from '../theme.js';

export default function UploadPage({ pin }) {
  const [mp3File,  setMp3File]  = useState(null);
  const [cdgFile,  setCdgFile]  = useState(null);
  const [status,   setStatus]   = useState('idle'); // idle | uploading | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const mp3Ref = useRef();
  const cdgRef = useRef();

  const reset = () => {
    setMp3File(null);
    setCdgFile(null);
    setStatus('idle');
    setErrorMsg('');
    if (mp3Ref.current) mp3Ref.current.value = '';
    if (cdgRef.current) cdgRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!mp3File || !cdgFile) return;
    setStatus('uploading');
    setErrorMsg('');
    const body = new FormData();
    body.append('mp3', mp3File);
    body.append('cdg', cdgFile);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'x-session-pin': pin },
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Upload failed');
        setStatus('error');
      } else {
        setStatus('success');
      }
    } catch (err) {
      setErrorMsg('Network error — check connection');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div style={styles.centered}>
        <div style={styles.successIcon}>✅</div>
        <p style={styles.successText}>Song uploaded!</p>
        <p style={styles.successSub}>It's now available in Search → Local</p>
        <button style={styles.btn} onClick={reset}>Upload another</button>
      </div>
    );
  }

  const bothSelected = mp3File && cdgFile;

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>Upload CDG Song</h2>
      <p style={styles.hint}>
        Upload a matching <strong>.mp3</strong> + <strong>.cdg</strong> pair to add it to this session's song library.
      </p>

      <div style={styles.dropZone} onClick={() => mp3Ref.current?.click()}>
        <input
          ref={mp3Ref}
          type="file"
          accept=".mp3,audio/mpeg"
          style={{ display: 'none' }}
          onChange={e => setMp3File(e.target.files[0] || null)}
        />
        <span style={styles.dropIcon}>🎵</span>
        <span style={styles.dropLabel}>
          {mp3File ? mp3File.name : 'Tap to select MP3 file'}
        </span>
        {mp3File && <span style={styles.checkmark}>✓</span>}
      </div>

      <div style={styles.dropZone} onClick={() => cdgRef.current?.click()}>
        <input
          ref={cdgRef}
          type="file"
          accept=".cdg"
          style={{ display: 'none' }}
          onChange={e => setCdgFile(e.target.files[0] || null)}
        />
        <span style={styles.dropIcon}>📄</span>
        <span style={styles.dropLabel}>
          {cdgFile ? cdgFile.name : 'Tap to select CDG file'}
        </span>
        {cdgFile && <span style={styles.checkmark}>✓</span>}
      </div>

      {errorMsg && <p style={styles.error}>{errorMsg}</p>}

      <button
        style={{ ...styles.btn, opacity: bothSelected && status !== 'uploading' ? 1 : 0.4 }}
        disabled={!bothSelected || status === 'uploading'}
        onClick={handleUpload}
      >
        {status === 'uploading' ? 'Uploading…' : 'Upload Song'}
      </button>
    </div>
  );
}

const styles = {
  page: {
    padding:   '24px 20px',
    maxWidth:  480,
    margin:    '0 auto',
    color:     theme.colors.text,
    fontFamily: theme.fonts.ui,
  },
  heading: {
    margin:     '0 0 8px',
    fontSize:   22,
    fontWeight: 700,
    color:      '#fff',
  },
  hint: {
    margin:     '0 0 24px',
    fontSize:   14,
    color:      theme.colors.textMuted,
    lineHeight: 1.5,
  },
  dropZone: {
    display:        'flex',
    alignItems:     'center',
    gap:            12,
    padding:        '16px 18px',
    marginBottom:   16,
    background:     theme.colors.bgCard,
    border:         `1px dashed ${theme.colors.border}`,
    borderRadius:   theme.radii.card,
    cursor:         'pointer',
    userSelect:     'none',
  },
  dropIcon: {
    fontSize: 24,
    flexShrink: 0,
  },
  dropLabel: {
    flex:       1,
    fontSize:   14,
    color:      theme.colors.textMuted,
    wordBreak:  'break-all',
  },
  checkmark: {
    color:      theme.colors.primary,
    fontSize:   20,
    fontWeight: 700,
    flexShrink: 0,
  },
  btn: {
    width:        '100%',
    padding:      '14px 0',
    marginTop:    8,
    background:   theme.colors.primary,
    color:        '#000',
    fontWeight:   700,
    fontSize:     16,
    border:       'none',
    borderRadius: theme.radii.card,
    cursor:       'pointer',
  },
  error: {
    color:       '#ff5555',
    fontSize:    13,
    margin:      '0 0 12px',
    padding:     '10px 14px',
    background:  'rgba(255,85,85,0.1)',
    borderRadius: theme.radii.card,
    border:      '1px solid rgba(255,85,85,0.3)',
  },
  centered: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    flex:           1,
    padding:        32,
    gap:            12,
    textAlign:      'center',
  },
  successIcon: { fontSize: 64 },
  successText: {
    fontSize:   22,
    fontWeight: 700,
    color:      '#fff',
    margin:     0,
  },
  successSub: {
    fontSize:  14,
    color:     theme.colors.textMuted,
    margin:    0,
  },
};
