import { useEffect, useState } from 'react';
import theme from '../theme.js';

const COUNTS = [3, 2, 1, 'GO!'];

export default function Countdown({ onDone }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= COUNTS.length) {
      onDone?.();
      return;
    }
    const t = setTimeout(() => setStep(s => s + 1), step === COUNTS.length - 1 ? 600 : 900);
    return () => clearTimeout(t);
  }, [step, onDone]);

  if (step >= COUNTS.length) return null;

  const isGo = COUNTS[step] === 'GO!';

  return (
    <div style={{
      position:         'fixed',
      inset:            0,
      display:          'flex',
      alignItems:       'center',
      justifyContent:   'center',
      background:       'rgba(0,0,0,0.85)',
      zIndex:           100,
      animation:        'fadeIn 0.2s ease',
    }}>
      <span style={{
        fontSize:   isGo ? '18vw' : '22vw',
        fontWeight: 900,
        fontFamily: theme.fonts.display,
        color:      isGo ? theme.colors.accent : theme.colors.primary,
        textShadow: `0 0 60px ${isGo ? theme.colors.accent : theme.colors.primaryGlow}`,
        animation:  'pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      }}>
        {COUNTS[step]}
      </span>
      <style>{`
        @keyframes pop {
          from { transform: scale(0.4); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
