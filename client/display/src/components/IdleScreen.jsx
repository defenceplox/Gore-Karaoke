import { QRCodeSVG } from 'qrcode.react';
import theme from '../theme.js';

export default function IdleScreen({ pin, queueLength, onStart }) {
  const remoteUrl = `${window.location.protocol}//${window.location.host}/remote`;

  return (
    <div style={styles.root} onClick={queueLength > 0 ? onStart : undefined}>
      <div style={styles.glow} />

      <div style={styles.icon}>🎤</div>

      <div style={styles.pinBlock}>
        <div style={styles.pinLabel}>Join on your phone</div>
        <div style={styles.pin}>
          {pin.split('').map((d, i) => (
            <span key={i} style={styles.pinDigit}>{d}</span>
          ))}
        </div>
        <div style={styles.pinSub}>PIN</div>
      </div>

      <div style={styles.qrBlock}>
        <QRCodeSVG
          value={`${remoteUrl}?pin=${pin}`}
          size={160}
          bgColor="transparent"
          fgColor="#ffffff"
          level="M"
          style={{ borderRadius: 8 }}
        />
        <div style={styles.qrLabel}>or scan to open remote</div>
      </div>

      <div style={styles.url}>{remoteUrl}</div>

      {queueLength > 0 && (
        <div style={styles.startHint}>
          {queueLength} song{queueLength !== 1 ? 's' : ''} queued — tap to start
        </div>
      )}
    </div>
  );
}

const styles = {
  root: {
    width:          '100%',
    height:         '100%',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            24,
    background:     'radial-gradient(ellipse at 50% 40%, #0d0d2e 0%, #000 70%)',
    cursor:         'default',
    position:       'relative',
    overflow:       'hidden',
  },
  glow: {
    position:   'absolute',
    top:        '20%',
    left:       '50%',
    transform:  'translateX(-50%)',
    width:      400,
    height:     400,
    background: `radial-gradient(circle, ${theme.colors.primaryGlow} 0%, transparent 70%)`,
    pointerEvents: 'none',
  },
  icon: {
    fontSize:  'clamp(48px, 8vw, 96px)',
    animation: 'float 3s ease-in-out infinite',
  },
  pinBlock: {
    textAlign: 'center',
  },
  pinLabel: {
    color:         theme.colors.textMuted,
    fontSize:      'clamp(14px, 2vw, 20px)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginBottom:  10,
  },
  pin: {
    display: 'flex',
    gap:     12,
    justifyContent: 'center',
  },
  pinDigit: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    width:          'clamp(56px, 8vw, 96px)',
    height:         'clamp(72px, 10vw, 120px)',
    background:     'rgba(255,255,255,0.06)',
    border:         `2px solid ${theme.colors.primary}`,
    borderRadius:   theme.radii.md,
    fontSize:       'clamp(36px, 6vw, 72px)',
    fontWeight:     900,
    color:          '#fff',
    fontFamily:     theme.fonts.display,
    boxShadow:      `0 0 20px ${theme.colors.primaryGlow}`,
  },
  pinSub: {
    color:         theme.colors.primary,
    fontSize:      13,
    fontWeight:    700,
    letterSpacing: '0.3em',
    marginTop:     8,
    textTransform: 'uppercase',
  },
  qrBlock: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           8,
    background:    'rgba(255,255,255,0.04)',
    border:        `1px solid ${theme.colors.border}`,
    borderRadius:  theme.radii.lg,
    padding:       '20px 24px',
  },
  qrLabel: {
    color:    theme.colors.textMuted,
    fontSize: 13,
  },
  url: {
    color:    theme.colors.textMuted,
    fontSize: 'clamp(12px, 1.5vw, 18px)',
    fontFamily: 'monospace',
  },
  startHint: {
    background:   theme.colors.primary,
    color:        '#fff',
    padding:      '10px 28px',
    borderRadius: theme.radii.pill,
    fontSize:     'clamp(14px, 2vw, 20px)',
    fontWeight:   700,
    cursor:       'pointer',
    animation:    'pulse 2s ease-in-out infinite',
  },
};
