import { useEffect, useState, useCallback, useRef } from 'react';
import { useSocket } from '../hooks/useSocket.js';
import { resume as resumeAudio } from '../audio/mixer.js';
import { preCacheQueue, evictSong } from '../audio/songCache.js';
import CDGPlayer        from '../components/CDGPlayer.jsx';
import YouTubePlayer    from '../components/YouTubePlayer.jsx';
import LyricsOverlay    from '../components/LyricsOverlay.jsx';
import QueueBar         from '../components/QueueBar.jsx';
import Countdown        from '../components/Countdown.jsx';
import NowPlayingBanner from '../components/NowPlayingBanner.jsx';
import MicManager       from '../components/MicManager.jsx';
import IdleScreen       from '../components/IdleScreen.jsx';
import theme            from '../theme.js';

export default function DisplayPage({ pin }) {  const { emit, on, connected } = useSocket(pin);
  const [queue,       setQueue]      = useState([]);
  const [nowPlaying,  setNowPlaying] = useState(null);
  const [currentMs,   setCurrentMs]  = useState(0);
  const [countdown,   setCountdown]  = useState(false);
  const [mics,        setMics]       = useState([]);
  const hasTouched       = useRef(false);
  const pendingPlaying   = useRef(null); // song waiting behind countdown

  // Join session and subscribe to events
  useEffect(() => {
    const unsubQueue = on('queue:update', ({ queue: q }) => {
      setQueue(q);
      preCacheQueue(q);
    });
    const unsubPlay  = on('playback:started', ({ nowPlaying: np, queue: q }) => {
      setQueue(q);
      preCacheQueue(q);
      if (np) {
        pendingPlaying.current = np;
        setCountdown(true);
      } else {
        setNowPlaying(null);
      }
    });
    return () => { unsubQueue(); unsubPlay(); };
  }, [on]);

  const handleSongEnded = useCallback(() => {
    if (nowPlaying) evictSong(nowPlaying);
    emit('playback:ended', {});
  }, [emit, nowPlaying]);

  const handleYTTimeUpdate = useCallback((t) => {
    const ms = t * 1000;
    setCurrentMs(ms);
    emit('playback:tick', { currentTime: t, duration: 0 });
  }, [emit]);

  const handleCountdownDone = useCallback(() => {
    setCountdown(false);
    if (pendingPlaying.current) {
      setNowPlaying(pendingPlaying.current);
      pendingPlaying.current = null;
    }
  }, []);

  // Resume WebAudio context on first user gesture
  const handleFirstTouch = () => {
    if (!hasTouched.current) {
      hasTouched.current = true;
      resumeAudio();
    }
  };

  if (!connected) {
    return (
      <div style={styles.centered}>
        <div style={styles.spinner} />
        <p style={{ color: theme.colors.textMuted, marginTop: 16 }}>Connecting…</p>
      </div>
    );
  }

  return (
    <div style={styles.root} onClick={handleFirstTouch}>
      {/* Invisible mic manager */}
      <MicManager pin={pin} onMicsChange={setMics} />

      {/* Countdown overlay */}
      {countdown && <Countdown onDone={handleCountdownDone} />}

      {/* Song player area */}
      <div style={styles.playerArea}>
        {nowPlaying?.source === 'cdg' && (
          <CDGPlayer
            mp3Url={nowPlaying.mp3_url}
            cdgUrl={nowPlaying.cdg_url}
            onEnded={handleSongEnded}
            style={{ width: '100%', height: '100%' }}
          />
        )}
        {nowPlaying?.source === 'youtube' && (
          <>
            <YouTubePlayer
              videoId={nowPlaying.youtube_id}
              onEnded={handleSongEnded}
              onTimeUpdate={handleYTTimeUpdate}
              style={{ width: '100%', height: '100%' }}
            />
            {nowPlaying.lyrics_data && (
              <LyricsOverlay
                lyricsData={nowPlaying.lyrics_data}
                currentTimeMs={currentMs}
              />
            )}
          </>
        )}
        {!nowPlaying && (
          <IdleScreen
            pin={pin}
            queueLength={queue.length}
            onStart={() => emit('playback:next', {})}
          />
        )}
      </div>

      {/* Always-visible overlays */}
      <NowPlayingBanner song={nowPlaying} />
      <QueueBar queue={queue} />

      {/* Mic indicator */}
      {mics.length > 0 && (
        <div style={styles.micIndicator}>
          🎤 {mics.length} mic{mics.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

const styles = {
  root: {
    width:     '100vw',
    height:    '100vh',
    background: '#000',
    position:  'relative',
    overflow:  'hidden',
    userSelect: 'none',
  },
  playerArea: {
    position: 'absolute',
    inset:    0,
    bottom:   56, // space for QueueBar
  },
  centered: {
    width:          '100vw',
    height:         '100vh',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    background:     '#000',
  },
  spinner: {
    width:  40,
    height: 40,
    border: `3px solid ${theme.colors.border}`,
    borderTop: `3px solid ${theme.colors.primary}`,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  micIndicator: {
    position:     'absolute',
    top:          20,
    right:        20,
    background:   'rgba(0,0,0,0.6)',
    color:        '#fff',
    fontSize:     13,
    padding:      '6px 12px',
    borderRadius: theme.radii.pill,
    border:       `1px solid ${theme.colors.border}`,
  },
};
