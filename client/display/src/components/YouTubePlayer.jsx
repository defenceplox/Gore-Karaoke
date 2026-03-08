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
 */
export default function YouTubePlayer({ videoId, onEnded, onTimeUpdate, style = {} }) {
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
        return;
      }

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          autoplay:       1,
          controls:       0,
          disablekb:      1,
          fs:             0,
          modestbranding: 1,
          rel:            0,
          iv_load_policy: 3,
        },
        events: {
          onReady:       (e) => { e.target.setVolume(100); },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.PLAYING) startTick();
            if (e.data === window.YT.PlayerState.ENDED) { stopTick(); onEnded?.(); }
            if (e.data === window.YT.PlayerState.PAUSED) stopTick();
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
