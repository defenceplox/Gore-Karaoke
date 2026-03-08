import { useEffect, useRef, useCallback } from 'react';
import CDGraphics from 'cdgraphics';

/**
 * CDGPlayer
 * Renders a CDG file to a <canvas> by synchronising frame renders
 * to an <audio> element's currentTime using requestAnimationFrame.
 */
export default function CDGPlayer({ mp3Url, cdgUrl, onEnded, style = {} }) {
  const audioRef  = useRef(null);
  const canvasRef = useRef(null);
  const cdgRef    = useRef(null);
  const rafRef    = useRef(null);

  const render = useCallback(() => {
    const audio  = audioRef.current;
    const canvas = canvasRef.current;
    const cdg    = cdgRef.current;
    if (!audio || !canvas || !cdg) return;

    const frames = cdg.render(audio.currentTime * 1000); // CDG uses milliseconds
    if (frames.isChanged) {
      const ctx = canvas.getContext('2d');
      const imageData = ctx.createImageData(frames.width, frames.height);
      imageData.data.set(frames.pixels);
      ctx.putImageData(imageData, 0, 0);
    }

    rafRef.current = requestAnimationFrame(render);
  }, []);

  useEffect(() => {
    if (!cdgUrl) return;

    let cancelled = false;

    fetch(cdgUrl)
      .then(r => r.arrayBuffer())
      .then(buf => {
        if (cancelled) return;
        const cdg = new CDGraphics();
        cdg.load(buf);
        cdgRef.current = cdg;

        // Set canvas dimensions to CDG standard (294×204)
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width  = 294;
          canvas.height = 204;
        }
        rafRef.current = requestAnimationFrame(render);
      })
      .catch(err => console.error('CDG load error:', err));

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      cdgRef.current = null;
    };
  }, [cdgUrl, render]);

  // Connect audio element to Web Audio mixer on first load
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !mp3Url) return;
    audio.src = mp3Url;
    audio.play().catch(err => console.warn('Audio play prevented:', err));
  }, [mp3Url]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      <audio
        ref={audioRef}
        onEnded={onEnded}
        style={{ display: 'none' }}
        crossOrigin="anonymous"
      />
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated',
          display: 'block',
        }}
      />
    </div>
  );
}
