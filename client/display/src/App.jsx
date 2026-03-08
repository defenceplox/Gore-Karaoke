import { useState, useEffect } from 'react';
import DisplayPage from './pages/DisplayPage.jsx';
import theme from './theme.js';

export default function App() {
  const [pin, setPin] = useState(null);
  const [inputPin, setInputPin] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  // Auto-read PIN from URL e.g. /display/1234
  useEffect(() => {
    const match = window.location.pathname.match(/\/display\/(\d{4})$/);
    if (match) setPin(match[1]);
  }, []);

  if (pin) return <DisplayPage pin={pin} />;

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const resp = await fetch('/api/sessions', { method: 'POST' });
      const data = await resp.json();
      if (data.ok) {
        window.history.pushState({}, '', `/display/${data.session.pin}`);
        setPin(data.session.pin);
      } else {
        setError(data.error || 'Failed to create session');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (inputPin.length !== 4) { setError('PIN must be 4 digits'); return; }
    const resp = await fetch(`/api/sessions/${inputPin}`);
    const data = await resp.json();
    if (data.ok) {
      window.history.pushState({}, '', `/display/${inputPin}`);
      setPin(inputPin);
    } else {
      setError('Session not found');
    }
  };

  return (
    <div style={styles.setup}>
      <div style={styles.card}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎤</div>
        <h1 style={styles.title}>Karaoke</h1>
        <p style={styles.sub}>Start a new session or join an existing one</p>

        <button style={styles.primaryBtn} onClick={handleCreate} disabled={creating}>
          {creating ? 'Creating…' : 'Start New Session'}
        </button>

        <div style={styles.divider}>or join with PIN</div>

        <form onSubmit={handleJoin} style={{ width: '100%' }}>
          <input
            style={styles.input}
            type="text"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            placeholder="1234"
            value={inputPin}
            onChange={e => setInputPin(e.target.value.replace(/\D/g, ''))}
          />
          <button style={styles.secondaryBtn} type="submit">Join</button>
        </form>

        {error && <p style={{ color: theme.colors.primary, marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  );
}

const styles = {
  setup: {
    width:          '100vw',
    height:         '100vh',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    background:     'radial-gradient(ellipse at center, #0d0d1a 0%, #000 70%)',
  },
  card: {
    background:    'rgba(255,255,255,0.04)',
    border:        `1px solid ${theme.colors.border}`,
    borderRadius:  theme.radii.lg,
    padding:       '48px 40px',
    width:         360,
    textAlign:     'center',
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           12,
  },
  title: { color: '#fff', fontSize: 36, fontWeight: 900, fontFamily: theme.fonts.display },
  sub:   { color: theme.colors.textMuted, fontSize: 15 },
  primaryBtn: {
    width:       '100%',
    padding:     '14px',
    background:  theme.colors.primary,
    color:       '#fff',
    border:      'none',
    borderRadius: theme.radii.md,
    fontSize:    16,
    fontWeight:  700,
    cursor:      'pointer',
    marginTop:   8,
  },
  secondaryBtn: {
    width:       '100%',
    padding:     '12px',
    background:  'transparent',
    color:       '#fff',
    border:      `1px solid ${theme.colors.border}`,
    borderRadius: theme.radii.md,
    fontSize:    16,
    cursor:      'pointer',
    marginTop:   8,
  },
  input: {
    width:       '100%',
    padding:     '12px 16px',
    background:  'rgba(255,255,255,0.07)',
    color:       '#fff',
    border:      `1px solid ${theme.colors.border}`,
    borderRadius: theme.radii.md,
    fontSize:    24,
    textAlign:   'center',
    letterSpacing: '0.3em',
    outline:     'none',
  },
  divider: {
    color:     theme.colors.textMuted,
    fontSize:  13,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    margin:    '12px 0 4px',
  },
};
