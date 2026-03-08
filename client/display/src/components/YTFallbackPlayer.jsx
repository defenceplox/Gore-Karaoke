import { useEffect, useRef, useState } from 'react';

/**
 * YTFallbackPlayer
 * Used when YouTube IFrame API refuses to embed a video (error 101/150).
 * Fetches a direct audio stream URL via yt-dlp on the server and plays
 * it with a plain <audio> element.
 *
 * Note: audio plays through the browser's normal output path rather than
 * the Web Audio mixer — mic channels are unaffected.
 */
export default function YTFallbackPlayer({ videoId, onEnded, onTimeUpdate, onError }) {
  const audioRef  = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | playing | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!videoId) return;
    setStatus('loading');
    setErrorMsg('');

    let cancelled = false;

    fetch(`/api/songs/ytstream?videoId=${videoId}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (!data.ok) throw new Error(data.error || 'Stream fetch failed');

        const audio = audioRef.current;
        if (!audio) return;
        audio.src    = data.url;
        audio.volume = 1;
        audio.play().then(() => {
          if (!cancelled) setStatus('playing');
        }).catch(playErr => {
          if (!cancelled) {
            setStatus('error');
            setErrorMsg(playErr.message);
            onError?.(playErr.message);
          }
        });
      })
      .catch(err => {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(err.message);
          onError?.(err.message);
        }
      });

    return () => {
      cancelled = true;
      clearInterval(tickRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
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
