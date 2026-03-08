import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import theme from '../theme.js';

export default function MicPage({ pin, singerName, nowPlaying, emit, on }) {
  const [micActive,  setMicActive]  = useState(false);
  const [micError,   setMicError]   = useState('');
  const [peerId,     setPeerId]     = useState('');
  const [volume,     setVolume]     = useState(80);
  const [currentMs,  setCurrentMs]  = useState(0);
  const [duration,   setDuration]   = useState(0);

  const peerRef    = useRef(null);
  const streamRef  = useRef(null);
  const callRef    = useRef(null);
  const gainRef    = useRef(null);
  const analyserRef = useRef(null);
  const vuRef      = useRef(null);
  const rafRef     = useRef(null);

  // Listen for playback ticks from display for lyrics sync
  useEffect(() => {
    const unsub = on('playback:tick', ({ currentTime, duration: d }) => {
      setCurrentMs(currentTime * 1000);
      setDuration(d);
    });
    return unsub;
  }, [on]);

  const startMic = useCallback(async () => {
    setMicError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate:       48000,
        },
      });
      streamRef.current = stream;

      // VU meter
      const ctx      = new AudioContext();
      const source   = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      drawVU();

      const peer = new Peer({
        host:   window.location.hostname,
        port:   Number(window.location.port) || (window.location.protocol === 'https:' ? 443 : 80),
        path:   '/peerjs',
        secure: window.location.protocol === 'https:',
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
          ],
        },
      });

      peerRef.current = peer;

      peer.on('open', (id) => {
        setPeerId(id);
        const call = peer.call(`display-${pin}`, stream);
        callRef.current = call;
        setMicActive(true);
        // Tell server/display about this mic
        emit('mic:connected', { peerId: id, singerName });
      });

      peer.on('error', (err) => {
        setMicError(`Mic error: ${err.message}`);
        stopMic();
      });
    } catch (err) {
      setMicError(
        err.name === 'NotAllowedError'
          ? 'Microphone access denied. Allow mic in browser settings.'
          : `Could not access mic: ${err.message}`
      );
    }
  }, [pin, singerName, emit]);

  const stopMic = useCallback(() => {
    callRef.current?.close();
    peerRef.current?.destroy();
    streamRef.current?.getTracks().forEach(t => t.stop());
    cancelAnimationFrame(rafRef.current);
    emit('mic:disconnected', { peerId });
    setMicActive(false);
    setPeerId('');
  }, [emit, peerId]);

  const drawVU = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas   = vuRef.current;
    if (!analyser || !canvas) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const avg = data.reduce((s, v) => s + v, 0) / data.length;
    const level = avg / 255;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bars = 20;
    for (let i = 0; i < bars; i++) {
      const active = i / bars < level;
      ctx.fillStyle = active
        ? (i > 15 ? '#e94560' : i > 10 ? '#f5a623' : '#4caf50')
        : 'rgba(255,255,255,0.08)';
      ctx.fillRect(i * (canvas.width / bars) + 2, 0, canvas.width / bars - 4, canvas.height);
    }
    rafRef.current = requestAnimationFrame(drawVU);
  }, []);

  useEffect(() => () => stopMic(), []);

  return (
    <div style={styles.page}>
      {/* Mic toggle */}
      <div style={styles.micSection}>
        <button
          style={{
            ...styles.micBtn,
            background: micActive
              ? `radial-gradient(circle, ${theme.colors.primary}, #a00)`
              : `radial-gradient(circle, #333, #111)`,
            boxShadow: micActive
              ? `0 0 40px ${theme.colors.primaryGlow}, 0 0 80px ${theme.colors.primaryGlow}`
              : 'none',
          }}
          onClick={micActive ? stopMic : startMic}
        >
          🎤
        </button>
        <div style={{ color: micActive ? theme.colors.primary : theme.colors.textMuted, fontWeight: 600 }}>
          {micActive ? 'Mic ON — tap to stop' : 'Tap to use your phone as a mic'}
        </div>
        {micError && <p style={{ color: theme.colors.primary, fontSize: 13, textAlign: 'center' }}>{micError}</p>}
      </div>

      {/* VU meter */}
      {micActive && (
        <canvas
          ref={vuRef}
          width={300}
          height={28}
          style={{ width: '100%', maxWidth: 360, borderRadius: theme.radii.sm }}
        />
      )}

      {/* Volume hint */}
      {micActive && (
        <p style={{ color: theme.colors.textMuted, fontSize: 13, textAlign: 'center' }}>
          Volume is controlled from the TV display
        </p>
      )}

      {/* Lyrics follow-along */}
      {nowPlaying && (
        <div style={styles.lyricsSection}>
          <div style={styles.lyricsLabel}>Now Playing</div>
          <div style={styles.lyricsTitle}>{nowPlaying.song_title}</div>
          <div style={styles.lyricsArtist}>{nowPlaying.artist_name}</div>
          {duration > 0 && (
            <div style={styles.progressBar}>
              <div style={{
                ...styles.progressFill,
                width: `${Math.min(100, (currentMs / 1000 / duration) * 100)}%`,
              }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    flex:          1,
    overflowY:     'auto',
    padding:       '24px 20px',
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           24,
  },
  micSection: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           12,
  },
  micBtn: {
    width:        120,
    height:       120,
    borderRadius: '50%',
    border:       'none',
    fontSize:     52,
    cursor:       'pointer',
    transition:   'all 0.2s ease',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
  },
  lyricsSection: {
    width:        '100%',
    background:   theme.colors.bgCard,
    border:       `1px solid ${theme.colors.border}`,
    borderRadius: theme.radii.md,
    padding:      '16px',
    textAlign:    'center',
  },
  lyricsLabel: {
    color:         theme.colors.primary,
    fontSize:      11,
    fontWeight:    700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom:  6,
  },
  lyricsTitle:  { color: '#fff', fontSize: 18, fontWeight: 700 },
  lyricsArtist: { color: theme.colors.textMuted, fontSize: 14, marginTop: 4 },
  progressBar: {
    marginTop:    12,
    height:       4,
    background:   'rgba(255,255,255,0.1)',
    borderRadius: theme.radii.pill,
    overflow:     'hidden',
  },
  progressFill: {
    height:     '100%',
    background: theme.colors.primary,
    borderRadius: theme.radii.pill,
    transition: 'width 0.5s linear',
  },
};
