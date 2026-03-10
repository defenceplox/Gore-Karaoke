import { useEffect, useRef, useState } from 'react';
import StageVisualizer from './StageVisualizer.jsx';

/**
 * YTFallbackPlayer
 * Used when YouTube IFrame API refuses to embed a video (error 101/150).
 * Points an <audio> element at /api/songs/ytproxy which pipes the yt-dlp
 * stream through the Express server — avoids CORS and YouTube CDN 403s.
 */
export default function YTFallbackPlayer({ videoId, onEnded, onTimeUpdate, onError }) {
  const audioRef = useRef(null);
  const [status,   setStatus]   = useState('loading'); // loading | playing | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!videoId) return;
    setStatus('loading');
    setErrorMsg('');

    const audio = audioRef.current;
    if (!audio) return;

    // Point directly at the proxy URL — no pre-fetch needed.
    // The server calls yt-dlp, caches the CDN URL, and pipes audio through.
    audio.src = `/api/songs/ytproxy?videoId=${videoId}`;
    audio.volume = 1;

    const onCanPlay = () => {
      setStatus('playing');
      audio.play().catch(err => {
        setStatus('error');
        setErrorMsg(err.message);
        onError?.(err.message);
      });
    };

    audio.addEventListener('canplay', onCanPlay);
    audio.load();

    return () => {
      audio.removeEventListener('canplay', onCanPlay);
      audio.pause();
      audio.src = '';
    };
  }, [videoId]);

  const handleTimeUpdate = () => {
    onTimeUpdate?.(audioRef.current?.currentTime ?? 0);
  };

  const handleEnded = () => {
    onEnded?.();
  };

  return (
    <>
      {/* Animated stage visuals — shown once audio is playing */}
      {status === 'playing' && <StageVisualizer audioRef={audioRef} />}

      {/* Hidden audio element — audio plays through browser output */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={() => {
          const msg = 'Stream playback error';
          setStatus('error');
          setErrorMsg(msg);
          onError?.(msg);
        }}
        style={{ display: 'none' }}
      />

      {/* Status overlay */}
      {status !== 'playing' && (
        <div style={styles.overlay}>
          {status === 'loading' && (
            <>
              <div style={styles.spinner} />
              <p style={styles.label}>Fetching stream via yt-dlp…</p>
            </>
          )}
          {status === 'error' && (
            <>
              <div style={{ fontSize: 40 }}>⚠️</div>
              <p style={styles.label}>Stream unavailable</p>
              <p style={styles.sub}>{errorMsg}</p>
            </>
          )}
        </div>
      )}
    </>
  );
}

const styles = {
  overlay: {
    position:       'absolute',
    inset:          0,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    background:     '#000',
    color:          '#fff',
    gap:            16,
  },
  spinner: {
    width:        48,
    height:       48,
    border:       '3px solid rgba(255,255,255,0.15)',
    borderTop:    '3px solid #fff',
    borderRadius: '50%',
    animation:    'spin 0.8s linear infinite',
  },
  label: {
    fontSize:   18,
    fontWeight: 600,
    margin:     0,
  },
  sub: {
    fontSize: 13,
    color:    'rgba(255,255,255,0.5)',
    margin:   0,
    maxWidth: 400,
    textAlign: 'center',
  },
};
