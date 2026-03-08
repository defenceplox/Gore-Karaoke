import { useState, useCallback } from 'react';
import theme from '../theme.js';

function formatViews(n) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K views`;
  return `${n} views`;
}

export default function SearchPage({ pin, singerName, emit, onAdd }) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [adding,  setAdding]  = useState(null);
  const [added,   setAdded]   = useState(new Set());

  const search = useCallback(async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const resp = await fetch(`/api/songs/search?q=${encodeURIComponent(query)}&pin=${pin}`);
      const data = await resp.json();
      if (data.ok) setResults(data.results);
      else setError(data.error || 'Search failed');
    } catch {
      setError('Cannot reach server');
    } finally {
      setLoading(false);
    }
  }, [query, pin]);

  const addToQueue = useCallback((song) => {
    if (!emit) return;
    setAdding(song.songId);
    emit('queue:add', { songData: song, singerName }, (resp) => {
      setAdding(null);
      if (resp?.ok) {
        setAdded(prev => new Set([...prev, song.songId]));
        onAdd?.(resp.queue);
      }
    });
  }, [emit, singerName, onAdd]);

  return (
    <div style={styles.page}>
      <form onSubmit={search} style={styles.searchBar}>
        <input
          style={styles.input}
          type="search"
          placeholder="Search songs or artists…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoCorrect="off"
          spellCheck={false}
        />
        <button style={styles.searchBtn} type="submit" disabled={loading}>
          {loading ? '…' : '🔍'}
        </button>
      </form>

      {error && <p style={styles.error}>{error}</p>}

      {!results.length && !loading && (
        <div style={styles.empty}>
          {query ? 'No results found' : 'Search for a song to get started'}
        </div>
      )}

      <div style={styles.results}>
        {results.map(song => (
          <div key={song.songId} style={styles.card}>
            <div style={styles.cardInfo}>
              {song.thumbnail && (
                <img
                  src={song.thumbnail}
                  alt=""
                  style={styles.thumbnail}
                />
              )}
              <div style={styles.cardText}>
                <div style={styles.songTitle}>{song.songTitle}</div>
                <div style={styles.artistName}>{song.artistName}</div>
                <div style={styles.metaRow}>
                  <span style={{
                    ...styles.badge,
                    background: song.source === 'youtube' ? '#c41' : '#0a5',
                  }}>
                    {song.source === 'youtube' ? 'YouTube' : 'CDG'}
                  </span>
                  {song.views > 0 && (
                    <span style={styles.views}>👁 {formatViews(song.views)}</span>
                  )}
                </div>
              </div>
            </div>
            <button
              style={{
                ...styles.addBtn,
                background: added.has(song.songId) ? theme.colors.success : theme.colors.primary,
              }}
              onClick={() => addToQueue(song)}
              disabled={added.has(song.songId) || adding === song.songId}
            >
              {added.has(song.songId) ? '✓' : adding === song.songId ? '…' : '+'}
            </button>
          </div>
        ))}
      </div>
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
  searchBar: {
    display:       'flex',
    gap:           8,
    marginBottom:  4,
  },
  input: {
    flex:         1,
    padding:      '12px 14px',
    background:   theme.colors.bgInput,
    color:        '#fff',
    border:       `1px solid ${theme.colors.border}`,
    borderRadius: theme.radii.md,
    fontSize:     16,
    outline:      'none',
  },
  searchBtn: {
    padding:      '12px 16px',
    background:   theme.colors.primary,
    color:        '#fff',
    border:       'none',
    borderRadius: theme.radii.md,
    fontSize:     18,
    cursor:       'pointer',
    flexShrink:   0,
  },
  error: {
    color:   theme.colors.primary,
    fontSize: 14,
    padding: '4px 0',
  },
  empty: {
    color:      theme.colors.textMuted,
    fontSize:   15,
    textAlign:  'center',
    padding:    '40px 0',
  },
  results: {
    display:       'flex',
    flexDirection: 'column',
    gap:           8,
  },
  card: {
    background:   theme.colors.bgCard,
    border:       `1px solid ${theme.colors.border}`,
    borderRadius: theme.radii.md,
    padding:      '12px',
    display:      'flex',
    alignItems:   'center',
    gap:          10,
  },
  cardInfo: {
    flex:       1,
    display:    'flex',
    gap:        10,
    overflow:   'hidden',
  },
  thumbnail: {
    width:        48,
    height:       36,
    objectFit:    'cover',
    borderRadius: theme.radii.sm,
    flexShrink:   0,
  },
  cardText: {
    overflow: 'hidden',
    flex: 1,
  },
  songTitle: {
    color:        '#fff',
    fontSize:     15,
    fontWeight:   600,
    overflow:     'hidden',
    textOverflow: 'ellipsis',
    whiteSpace:   'nowrap',
  },
  artistName: {
    color:        theme.colors.textMuted,
    fontSize:     13,
    overflow:     'hidden',
    textOverflow: 'ellipsis',
    whiteSpace:   'nowrap',
  },
  metaRow: {
    display:    'flex',
    alignItems: 'center',
    gap:        6,
    marginTop:  3,
  },
  views: {
    fontSize: 10,
    color:    theme.colors.textMuted,
  },
  badge: {
    display:      'inline-block',
    padding:      '1px 6px',
    borderRadius: theme.radii.pill,
    fontSize:     10,
    fontWeight:   700,
    color:        '#fff',
    marginTop:    4,
  },
  addBtn: {
    width:        40,
    height:       40,
    borderRadius: theme.radii.pill,
    border:       'none',
    color:        '#fff',
    fontSize:     22,
    fontWeight:   700,
    cursor:       'pointer',
    flexShrink:   0,
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
  },
};
