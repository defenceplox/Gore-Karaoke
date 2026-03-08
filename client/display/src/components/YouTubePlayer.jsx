import { useEffect, useRef, useCallback } from 'react';

let ytApiReady = false;
let ytApiCallbacks = [];

function loadYouTubeAPI() {
  if (ytApiReady) return Promise.resolve();
  return new Promise((resolve) => {
    ytApiCallbacks.push(resolve);
    if (!document.getElementById('yt-api-script')) {
      window.onYouTubeIframeAPIReady = () => {
        ytApiReady = true;
        ytApiCallbacks.forEach(fn => fn());
        ytApiCallbacks = [];
      };
      const script = document.createElement('script');
      script.id  = 'yt-api-script';
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }
  });
}

/**
 * YouTubePlayer
 * Embeds a YouTube video (used as an audio karaoke track).
 * Fires onTimeUpdate every 500ms with currentTime for lyrics sync.
 * Fires onEnded when the video finishes.
 * Fires onError(message) when the video can't be played (e.g. embedding disabled).
 */
export default function YouTubePlayer({ videoId, onEnded, onTimeUpdate, onError, style = {} }) {
  const containerRef = useRef(null);
  const playerRef    = useRef(null);
  const tickRef      = useRef(null);

  const startTick = useCallback(() => {
    tickRef.current = setInterval(() => {
      const t = playerRef.current?.getCurrentTime?.();
      if (t != null) onTimeUpdate?.(t);
    }, 500);
  }, [onTimeUpdate]);

  const stopTick = useCallback(() => {
    clearInterval(tickRef.current);
  }, []);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;

    loadYouTubeAPI().then(() => {
      if (cancelled) return;
      if (playerRef.current) {
        playerRef.current.loadVideoById(videoId);
        playerRef.current.playVideo();
        return;
      }

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          autoplay:       1,
          mute:           1,  // start muted so browser permits autoplay
          controls:       0,
          disablekb:      1,
          fs:             0,
          modestbranding: 1,
          rel:            0,
          iv_load_policy: 3,
        },
        events: {
          onReady: (e) => {
            e.target.playVideo();
            // Unmute after a tick — browser allows this once playback has started
            setTimeout(() => { e.target.unMute(); e.target.setVolume(100); }, 100);
          },
          onError:       (e) => {
            stopTick();
            // 101 / 150 = embedding disabled by owner; 100 = video not found/private
            const msg = (e.data === 101 || e.data === 150)
              ? 'Embedding disabled by video owner'
              : `YouTube error ${e.data}`;
            onError?.(msg);
          },
          onStateChange: (e) => {
            const S = window.YT.PlayerState;
            // CUED fires when loadVideoById is called on an existing player
            if (e.data === S.CUED) {
              e.target.playVideo();
            }
            if (e.data === S.PLAYING) {
              // Ensure unmuted (may have been muted for autoplay bypass)
              if (e.target.isMuted()) { e.target.unMute(); e.target.setVolume(100); }
              startTick();
            }
            if (e.data === S.ENDED)  { stopTick(); onEnded?.(); }
            if (e.data === S.PAUSED) { stopTick(); }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      stopTick();
    };
  }, [videoId, startTick, stopTick, onEnded]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
