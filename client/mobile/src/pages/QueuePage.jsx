import { useState, useCallback, useRef } from 'react';
import theme from '../theme.js';

export default function QueuePage({ pin, queue, nowPlaying, emit }) {
  const [removing,   setRemoving]   = useState(null);
  const [localQueue, setLocalQueue] = useState(null); // optimistic drag state
  const [dragging,   setDragging]   = useState(null); // dragged item id
  const voterId = sessionStorage.getItem('karaoke-voter-id') || 'anon';

  // Use localQueue during drag, prop queue otherwise
  const displayQueue = localQueue ?? queue;

  const removeItem = useCallback((itemId) => {
    setRemoving(itemId);
    emit('queue:remove', { itemId }, () => setRemoving(null));
  }, [emit]);

  const voteItem = useCallback((itemId) => {
    emit('queue:vote', { itemId, voterId });
  }, [emit, voterId]);

  const skip = useCallback(() => {
    emit('playback:skip', {});
  }, [emit]);

  const nudgeLyrics = useCallback((delta) => {
    emit('lyrics:offset', { delta });
  }, [emit]);

  // ── Drag-to-reorder via pointer events ──────────────────────────
  const dragState = useRef(null); // { id, startY, startIndex, itemHeight }

  const onDragStart = useCallback((e, itemId, index) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    dragState.current = {
      id: itemId,
      startY: e.clientY,
      startIndex: index,
      itemHeight: rect.height + 8, // 8 = gap
    };
    setDragging(itemId);
    setLocalQueue([...queue]);
  }, [queue]);

  const onDragMove = useCallback((e, index) => {
    if (!dragState.current) return;
    const { startY, startIndex, itemHeight } = dragState.current;
    const delta = e.clientY - startY;
    const newIndex = Math.max(0, Math.min(
      queue.length - 1,
      Math.round(startIndex + delta / itemHeight),
    ));
    if (newIndex === index) return;
    setLocalQueue(prev => {
      if (!prev) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(newIndex, 0, item);
      return next;
    });
  }, [queue.length]);

  const onDragEnd = useCallback(() => {
    if (!dragState.current || !localQueue) {
      dragState.current = null;
      setDragging(null);
      return;
    }
    const orderedIds = localQueue.map(i => i.id);
    emit('queue:reorder', { orderedIds });
    dragState.current = null;
    setDragging(null);
    setLocalQueue(null);
  }, [emit, localQueue]);

  const startQueue = useCallback(() => {
    emit('playback:next', {});
  }, [emit]);

  return (
    <div style={styles.page}>
      {/* Start button — shown when idle with songs queued */}
      {!nowPlaying && displayQueue.length > 0 && (
        <button style={styles.startBtn} onClick={startQueue}>
          ▶ Start Queue
        </button>
      )}

      {/* Now Playing */}
      {nowPlaying && (
        <div style={styles.nowPlaying}>
          <div style={styles.npLabel}>Now Playing</div>
          <div style={styles.npTitle}>{nowPlaying.song_title}</div>
          <div style={styles.npArtist}>
            {nowPlaying.artist_name}
            <span style={{ color: theme.colors.textMuted }}>  ·  {nowPlaying.singer_name}</span>
          </div>
          <button style={styles.skipBtn} onClick={skip}>Skip ⏭</button>
          <div style={styles.lyricsRow}>
            <span style={styles.lyricsLabel}>Lyrics timing</span>
            <button style={styles.nudgeBtn} onClick={() => nudgeLyrics(-250)}>◀ Earlier</button>
            <button style={styles.nudgeBtn} onClick={() => nudgeLyrics(+250)}>Later ▶</button>
          </div>
        </div>
      )}

      {/* Queue list */}
      {displayQueue.length === 0 ? (
        <div style={styles.empty}>
          Queue is empty — search for a song to add it!
        </div>
      ) : (
        <div style={styles.list}>
          {displayQueue.map((item, i) => (
            <div
              key={item.id}
              style={{
                ...styles.item,
                opacity:   dragging === item.id ? 0.5 : 1,
                transform: dragging === item.id ? 'scale(1.02)' : 'none',
                transition: dragging ? 'none' : 'transform 0.15s',
              }}
            >
              {/* Drag handle */}
              <div
                style={styles.dragHandle}
                onPointerDown={e => onDragStart(e, item.id, i)}
                onPointerMove={e => { if (dragState.current?.id === item.id) onDragMove(e, i); }}
                onPointerUp={onDragEnd}
                onPointerCancel={onDragEnd}
              >
                ⠿
              </div>
              <div style={styles.position}>{i + 1}</div>
              <div style={styles.itemInfo}>
                <div style={styles.itemTitle}>{item.song_title}</div>
                <div style={styles.itemMeta}>
                  {item.artist_name}
                  <span style={{ color: theme.colors.primary }}> · {item.singer_name}</span>
                </div>
              </div>
              <div style={styles.actions}>
                <button
                  style={styles.voteBtn}
                  onClick={() => voteItem(item.id)}
                  title="Vote to move up"
                >
                  👍
                </button>
                <button
                  style={{
                    ...styles.removeBtn,
                    opacity: removing === item.id ? 0.4 : 1,
                  }}
                  onClick={() => removeItem(item.id)}
                  disabled={removing === item.id}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
    gap:           10,
  },
  startBtn: {
    width:        '100%',
    padding:      '14px',
    background:   theme.colors.primary,
    color:        '#fff',
    border:       'none',
    borderRadius: theme.radii.md,
    fontSize:     17,
    fontWeight:   700,
    cursor:       'pointer',
    letterSpacing: '0.03em',
  },
  nowPlaying: {
    background:   `linear-gradient(135deg, ${theme.colors.secondary}, ${theme.colors.bgCard})`,
    border:       `1px solid ${theme.colors.primary}44`,
    borderRadius: theme.radii.md,
    padding:      '14px 16px',
    marginBottom: 4,
  },
  npLabel: {
    color:         theme.colors.primary,
    fontSize:      11,
    fontWeight:    700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom:  4,
  },
  npTitle:  { color: '#fff', fontSize: 17, fontWeight: 700 },
  npArtist: { color: theme.colors.textMuted, fontSize: 14, marginTop: 2 },
  skipBtn: {
    marginTop:    10,
    padding:      '8px 16px',
    background:   'rgba(255,255,255,0.08)',
    color:        '#fff',
    border:       `1px solid ${theme.colors.border}`,
    borderRadius: theme.radii.pill,
    fontSize:     14,
    cursor:       'pointer',
  },
  lyricsRow: {
    display:     'flex',
    alignItems:  'center',
    gap:         8,
    marginTop:   10,
  },
  lyricsLabel: {
    fontSize:   12,
    color:      theme.colors.textMuted,
    flexShrink: 0,
  },
  nudgeBtn: {
    padding:      '6px 12px',
    background:   'rgba(255,255,255,0.06)',
    color:        '#fff',
    border:       `1px solid ${theme.colors.border}`,
    borderRadius: theme.radii.pill,
    fontSize:     13,
    cursor:       'pointer',
  },
  empty: {
    color:     theme.colors.textMuted,
    fontSize:  15,
    textAlign: 'center',
    padding:   '40px 0',
  },
  list: {
    display:       'flex',
    flexDirection: 'column',
    gap:           8,
  },
  item: {
    background:   theme.colors.bgCard,
    border:       `1px solid ${theme.colors.border}`,
    borderRadius: theme.radii.md,
    padding:      '12px 14px',
    display:      'flex',
    alignItems:   'center',
    gap:          10,
    touchAction:  'none',
  },
  dragHandle: {
    color:       theme.colors.textMuted,
    fontSize:    22,
    lineHeight:  1,
    cursor:      'grab',
    flexShrink:  0,
    userSelect:  'none',
    padding:     '0 4px',
  },
  position: {
    color:      theme.colors.textMuted,
    fontSize:   18,
    fontWeight: 700,
    minWidth:   24,
    textAlign:  'center',
  },
  itemInfo:  { flex: 1, overflow: 'hidden' },
  itemTitle: {
    color:        '#fff',
    fontSize:     15,
    fontWeight:   600,
    overflow:     'hidden',
    textOverflow: 'ellipsis',
    whiteSpace:   'nowrap',
  },
  itemMeta: {
    fontSize:     13,
    color:        theme.colors.textMuted,
    marginTop:    2,
  },
  actions: {
    display:    'flex',
    gap:        6,
    flexShrink: 0,
  },
  voteBtn: {
    width:        36,
    height:       36,
    background:   'rgba(255,255,255,0.06)',
    border:       `1px solid ${theme.colors.border}`,
    borderRadius: theme.radii.pill,
    fontSize:     16,
    cursor:       'pointer',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
  },
  removeBtn: {
    width:        36,
    height:       36,
    background:   'rgba(233,69,96,0.12)',
    border:       `1px solid ${theme.colors.primary}44`,
    borderRadius: theme.radii.pill,
    color:        theme.colors.primary,
    fontSize:     14,
    cursor:       'pointer',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
  },
};
