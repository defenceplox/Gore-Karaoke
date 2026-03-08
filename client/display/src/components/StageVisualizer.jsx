import { useEffect, useRef } from 'react';

/**
 * StageVisualizer
 * Animated canvas background for the yt-dlp audio-only fallback.
 * Optionally hooks into a real <audio> element via Web Audio API for
 * frequency-reactive visuals. Falls back to a gentle animation if no
 * audio element is provided.
 */
export default function StageVisualizer({ audioRef }) {
  const canvasRef  = useRef(null);
  const frameRef   = useRef(null);
  const analyserRef = useRef(null);

  // Connect Web Audio analyser to the audio element once it's playing
  useEffect(() => {
    const audio = audioRef?.current;
    if (!audio) return;

    let ctx, source, analyser;
    const onPlay = () => {
      try {
        ctx      = new AudioContext();
        source   = ctx.createMediaElementSource(audio);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        analyserRef.current = analyser;
      } catch {
        // Already connected or not allowed — silent fallback
      }
    };

    audio.addEventListener('play', onPlay);
    return () => {
      audio.removeEventListener('play', onPlay);
      try { source?.disconnect(); analyser?.disconnect(); ctx?.close(); } catch {}
      analyserRef.current = null;
    };
  }, [audioRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Particles ──────────────────────────────────────────────────────────
    const PARTICLE_COUNT = 70;
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x:     Math.random(),
      y:     Math.random(),
      r:     1 + Math.random() * 2.5,
      dx:    (Math.random() - 0.5) * 0.00025,
      dy:    -(0.00008 + Math.random() * 0.00025),
      hue:   Math.random() * 360,
      alpha: 0.3 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
    }));

    // ── Spotlight beams ───────────────────────────────────────────────────
    const BEAMS = 7;

    const start = performance.now();

    const draw = (now) => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      if (canvas.width !== W)  canvas.width  = W;
      if (canvas.height !== H) canvas.height = H;

      const t = (now - start) / 1000;
      const ctx = canvas.getContext('2d');

      // ── Background gradient ────────────────────────────────────────────
      const h1 = (t * 12) % 360;
      const h2 = (h1 + 140) % 360;
      const h3 = (h1 + 260) % 360;
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, W * 0.9);
      bg.addColorStop(0,   `hsl(${h1},55%,14%)`);
      bg.addColorStop(0.5, `hsl(${h2},45%,8%)`);
      bg.addColorStop(1,   `hsl(${h3},35%,4%)`);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── Spotlight beams from top ──────────────────────────────────────
      const spotY = -60;
      const spotX = W * 0.5;
      for (let i = 0; i < BEAMS; i++) {
        const baseAngle = (Math.PI / 2) + (i - (BEAMS - 1) / 2) * 0.22;
        const angle     = baseAngle + Math.sin(t * 0.4 + i * 0.9) * 0.07;
        const spread    = 0.055;
        const hue       = (h1 + i * (360 / BEAMS)) % 360;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(spotX, spotY);
        const a1 = angle - spread;
        const a2 = angle + spread;
        const len = H * 2.2;
        ctx.lineTo(spotX + Math.cos(a1) * len, spotY + Math.sin(a1) * len);
        ctx.lineTo(spotX + Math.cos(a2) * len, spotY + Math.sin(a2) * len);
        ctx.closePath();
        const bGrad = ctx.createLinearGradient(
          spotX, spotY,
          spotX + Math.cos(angle) * len * 0.7,
          spotY + Math.sin(angle) * len * 0.7,
        );
        bGrad.addColorStop(0,   `hsla(${hue},100%,75%,0.13)`);
        bGrad.addColorStop(0.5, `hsla(${hue},100%,65%,0.05)`);
        bGrad.addColorStop(1,   `hsla(${hue},100%,55%,0)`);
        ctx.fillStyle = bGrad;
        ctx.fill();
        ctx.restore();
      }

      // ── Particles ────────────────────────────────────────────────────
      for (const p of particles) {
        p.x += p.dx;
        p.y += p.dy;
        if (p.y < -0.03)  { p.y = 1.05;  p.x = Math.random(); }
        if (p.x < -0.03)  p.x =  1.03;
        if (p.x >  1.03)  p.x = -0.03;
        const pulse = 1 + 0.35 * Math.sin(t * 2.5 + p.phase);
        const hue   = (p.hue + t * 25) % 360;
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue},100%,78%,${p.alpha * 0.85})`;
        ctx.fill();
      }

      // ── Frequency bars (if audio analyser connected) ─────────────────
      const analyser = analyserRef.current;
      if (analyser) {
        const buf = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(buf);
        const barCount  = buf.length;
        const barW      = W / barCount;
        const maxH      = H * 0.22;

        ctx.save();
        for (let i = 0; i < barCount; i++) {
          const v    = buf[i] / 255;
          const barH = v * maxH;
          const hue  = (h1 + i * (280 / barCount)) % 360;
          const x    = i * barW;
          const y    = H - barH;

          const barGrad = ctx.createLinearGradient(x, y, x, H);
          barGrad.addColorStop(0,   `hsla(${hue},100%,70%,${0.5 + v * 0.5})`);
          barGrad.addColorStop(1,   `hsla(${hue},100%,50%,0.15)`);
          ctx.fillStyle = barGrad;
          ctx.fillRect(x, y, Math.max(1, barW - 1), barH);
        }
        ctx.restore();
      } else {
        // Fake "idle" wave along the bottom when no analyser
        ctx.save();
        ctx.strokeStyle = `hsla(${h1},80%,70%,0.25)`;
        ctx.lineWidth   = 2;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 3) {
          const y = H - 30 - Math.sin((x / W) * Math.PI * 6 + t * 3) * 18
                         - Math.sin((x / W) * Math.PI * 3 + t * 1.7) * 10;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    />
  );
}
