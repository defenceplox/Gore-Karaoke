import { useState, useEffect } from 'react';
import theme from '../theme.js';

export default function HistoryPage({ pin }) {
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    if (!pin) return;
    setLoading(true);
    fetch(`/api/queue/history?pin=${pin}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) setHistory(data.history || []);
        else setError(data.error || 'Failed to load history');
      })
      .catch(() => setError('Cannot reach server'))
      .finally(() => setLoading(false));
  }, [pin]);

  if (loading) {
    return (
      <div style={styles.center}>
        <p style={{ color: theme.colors.textMuted, fontSize: 15 }}>Loading history…</p>
      </div>
    );
  }

  if (error) {
    return <p style={styles.error}>{error}</p>;
  }

  if (!history.length) {
    return (
      <div style={styles.center}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎶</div>
        <p style={{ color: theme.colors.textMuted, fontSize: 15 }}>
          No songs played yet this session
        </p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <p style={styles.subtitle}>{history.length} song{history.length !== 1 ? 's' : ''} played this session</p>
      {history.map((item, i) => (
        <div key={item.id} style={styles.row}>
          <div style={styles.index}>#{i + 1}</div>
          <div style={styles.info}>
            <div style={styles.title}>{item.song_title}</div>
            <div style={styles.meta}>
              <span style={styles.artist}>{item.artist_name}</span>
              {item.singer_name && item.singer_name !== 'Anonymous' && (
                <span style={styles.singer}>🎤 {item.singer_name}</span>
              )}
              <span style={{
                ...styles.statusBadge,
                background: item.status === 'skipped' ? '#555' : '#1a472a',
              }}>
                {item.status === 'skipped' ? 'skipped' : 'played'}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  page: {
    flex:          1,
    overflowY:     'auto',
    padding:       '12px 16px',
    display:       'flex',
    flexDirection: 'column',
    gap:           8,
  },
  center: {
    flex:           1,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        32,
  },
  subtitle: {
    color:     theme.colors.textMuted,
    fontSize:  13,
    margin:    '0 0 4px',
    fontWeight: 500,
  },
  error: {
    color:   theme.colors.primary,
    padding: 16,
    fontSize: 14,
  },
  row: {
    background:   theme.colors.bgCard,
    border:       `1px solid ${theme.colors.border}`,
    borderRadius: theme.radii.md,
    padding:      '10px 12px',
    display:      'flex',
    alignItems:   'center',
    gap:          12,
  },
  index: {
    color:      theme.colors.textMuted,
    fontSize:   13,
    fontWeight: 600,
    minWidth:   28,
    textAlign:  'right',
    flexShrink: 0,
  },
  info: {
    flex:     1,
    overflow: 'hidden',
  },
  title: {
    color:        '#fff',
    fontSize:     15,
    fontWeight:   600,
    overflow:     'hidden',
    textOverflow: 'ellipsis',
    whiteSpace:   'nowrap',
  },
  meta: {
    display:    'flex',
    alignItems: 'center',
    gap:        8,
    marginTop:  3,
    flexWrap:   'wrap',
  },
  artist: {
    color:    theme.colors.textMuted,
    fontSize: 12,
  },
  singer: {
    color:    theme.colors.textMuted,
    fontSize: 12,
  },
  statusBadge: {
    display:      'inline-block',
    padding:      '1px 6px',
    borderRadius: theme.radii.pill,
    fontSize:     10,
    fontWeight:   700,
    color:        'rgba(255,255,255,0.7)',
  },
};
