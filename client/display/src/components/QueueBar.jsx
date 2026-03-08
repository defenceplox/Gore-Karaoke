import theme from '../theme.js';

export default function QueueBar({ queue }) {
  if (!queue?.length) return null;

  return (
    <div style={{
      position:    'absolute',
      bottom:      0,
      left:        0,
      right:       0,
      height:      56,
      background:  'linear-gradient(to right, rgba(0,0,0,0.95), rgba(13,13,26,0.95))',
      borderTop:   `1px solid ${theme.colors.border}`,
      display:     'flex',
      alignItems:  'center',
      padding:     '0 20px',
      gap:         32,
      overflow:    'hidden',
    }}>
      <span style={{
        color:      theme.colors.primary,
        fontWeight: 700,
        fontSize:   13,
        whiteSpace: 'nowrap',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        flexShrink: 0,
      }}>
        Up Next
      </span>

      <div style={{
        display:  'flex',
        gap:      32,
        overflow: 'hidden',
        flexWrap: 'nowrap',
      }}>
        {queue.slice(0, 8).map((item, i) => (
          <div key={item.id} style={{
            display:    'flex',
            alignItems: 'center',
            gap:        8,
            whiteSpace: 'nowrap',
            opacity:    1 - i * 0.11,
          }}>
            <span style={{
              background: theme.colors.secondary,
              color:      theme.colors.textMuted,
              fontSize:   11,
              fontWeight: 700,
              borderRadius: theme.radii.pill,
              padding:    '2px 7px',
              minWidth:   22,
              textAlign:  'center',
            }}>
              {i + 1}
            </span>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
              {item.song_title}
            </span>
            <span style={{ color: theme.colors.textMuted, fontSize: 13 }}>
              {item.singer_name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
