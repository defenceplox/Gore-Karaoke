import theme from '../theme.js';

export default function NowPlayingBanner({ song }) {
  if (!song) return null;

  return (
    <div style={{
      position:   'absolute',
      top:        20,
      left:       '50%',
      transform:  'translateX(-50%)',
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(12px)',
      border:     `1px solid ${theme.colors.border}`,
      borderRadius: theme.radii.lg,
      padding:    '10px 28px',
      textAlign:  'center',
      maxWidth:   '80vw',
      zIndex:     10,
    }}>
      <div style={{
        color:      theme.colors.textMuted,
        fontSize:   11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        marginBottom: 3,
      }}>
        Now Singing
      </div>
      <div style={{
        color:      '#fff',
        fontSize:   'clamp(16px, 2.5vw, 24px)',
        fontWeight: 700,
        lineHeight: 1.2,
      }}>
        {song.song_title}
      </div>
      <div style={{
        color:      theme.colors.primary,
        fontSize:   'clamp(13px, 1.8vw, 18px)',
        fontWeight: 500,
        marginTop:  2,
      }}>
        {song.artist_name}
        <span style={{ color: theme.colors.textMuted, fontWeight: 400, marginLeft: 8 }}>
          · {song.singer_name}
        </span>
      </div>
    </div>
  );
}
