import { useState } from 'react';
import theme from '../theme.js';

export default function JoinPage({ onJoin }) {
  // Pre-fill PIN from URL query param (set by QR code scan)
  const urlPin = new URLSearchParams(window.location.search).get('pin') || '';
  const [pin,      setPin]      = useState(urlPin);
  const [name,     setName]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleJoin = async (e) => {
    e.preventDefault();
    if (pin.length !== 4) { setError('Enter the 4-digit PIN shown on the TV'); return; }
    if (!name.trim())     { setError('Enter your name'); return; }

    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`/api/sessions/${pin}`);
      const data = await resp.json();
      if (data.ok) {
        // Store identity in sessionStorage
        sessionStorage.setItem('karaoke-singer', name.trim());
        sessionStorage.setItem('karaoke-pin', pin);
        sessionStorage.setItem('karaoke-voter-id', crypto.randomUUID());
        onJoin(pin, name.trim());
      } else {
        setError('Session not found — check the PIN on the TV');
      }
    } catch (e) {
      setError('Cannot reach server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div style={{ fontSize: 64 }}>🎤</div>
        <h1 style={styles.h1}>Karaoke</h1>
        <p style={styles.sub}>Join the party</p>
      </div>

      <form onSubmit={handleJoin} style={styles.form}>
        <label style={styles.label}>Your name</label>
        <input
          style={styles.input}
          type="text"
          placeholder="Rockstar"
          value={name}
          onChange={e => setName(e.target.value)}
          autoComplete="nickname"
        />

        <label style={styles.label}>Session PIN <span style={{ color: theme.colors.textMuted }}>(from TV)</span></label>
        <input
          style={{ ...styles.input, letterSpacing: '0.4em', fontSize: 28, textAlign: 'center' }}
          type="text"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          placeholder="1234"
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
        />

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.btn} type="submit" disabled={loading}>
          {loading ? 'Joining…' : 'Join Party 🎉'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  page: {
    minHeight:     '100dvh',
    background:    theme.colors.bg,
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    padding:       '40px 24px 32px',
  },
  hero: {
    textAlign: 'center',
    marginBottom: 40,
  },
  h1: {
    color:      '#fff',
    fontSize:   36,
    fontWeight: 900,
    margin:     '8px 0 4px',
  },
  sub: {
    color:    theme.colors.textMuted,
    fontSize: 16,
  },
  form: {
    width:         '100%',
    maxWidth:      360,
    display:       'flex',
    flexDirection: 'column',
    gap:           8,
  },
  label: {
    color:      theme.colors.textMuted,
    fontSize:   13,
    fontWeight: 600,
    marginTop:  8,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  },
  input: {
    width:       '100%',
    padding:     '14px 16px',
    background:  theme.colors.bgInput,
    color:       '#fff',
    border:      `1px solid ${theme.colors.border}`,
    borderRadius: theme.radii.md,
    fontSize:    18,
    outline:     'none',
  },
  error: {
    color:     theme.colors.primary,
    fontSize:  14,
    marginTop: 4,
  },
  btn: {
    marginTop:    16,
    padding:      '16px',
    background:   theme.colors.primary,
    color:        '#fff',
    border:       'none',
    borderRadius: theme.radii.md,
    fontSize:     18,
    fontWeight:   700,
    cursor:       'pointer',
  },
};
