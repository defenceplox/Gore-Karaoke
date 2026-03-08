import { useState, useCallback } from 'react';
import { setMicGain, setReverbAmount, getReverbAmount } from '../audio/mixer.js';
import theme from '../theme.js';

/**
 * MicControls
 * Floating panel (top-right) for controlling mic volumes and reverb.
 * Collapsed by default — click the mic indicator to expand.
 *
 * Props:
 *   mics  – array of mic IDs from MicManager (e.g. ['physical', 'display-1234-xxx'])
 */
export default function MicControls({ mics }) {
  const [open,       setOpen]       = useState(false);
  const [volumes,    setVolumes]    = useState({});   // id → 0–1
  const [reverb,     setReverb]     = useState(() => getReverbAmount());

  const handleVolume = useCallback((id, value) => {
    const v = parseFloat(value);
    setVolumes(prev => ({ ...prev, [id]: v }));
    setMicGain(id, v);
  }, []);

  const handleReverb = useCallback((value) => {
    const v = parseFloat(value);
    setReverb(v);
    setReverbAmount(v);
  }, []);

  const toggleReverb = useCallback(() => {
    handleReverb(reverb > 0 ? 0 : 0.5);
  }, [reverb, handleReverb]);

  if (!mics || mics.length === 0) return null;

  const labelFor = (id, i) => {
    if (id === 'physical') return '🎙 Local';
    return `📱 Phone ${i}`;
  };

  // Count only phone mics for numbering
  let phoneIdx = 0;

  return (
    <div style={styles.root}>
      {/* Collapsed trigger */}
      <button style={styles.trigger} onClick={() => setOpen(o => !o)}>
        🎤 {mics.length} mic{mics.length !== 1 ? 's' : ''}
        {reverb > 0 && <span style={styles.reverbBadge}>FX</span>}
        <span style={styles.caret}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Expanded panel */}
      {open && (
        <div style={styles.panel}>
          {/* Per-mic volume sliders */}
          {mics.map((id) => {
            const isPhone = id !== 'physical';
            if (isPhone) phoneIdx++;
            const label = labelFor(id, phoneIdx);
            const vol   = volumes[id] ?? 1.0;

            return (
              <div key={id} style={styles.row}>
                <span style={styles.label}>{label}</span>
                <input
                  type="range"
                  min="0" max="1.5" step="0.05"
                  value={vol}
                  onChange={e => handleVolume(id, e.target.value)}
                  style={styles.slider}
                />
                <span style={styles.value}>{Math.round(vol * 100)}%</span>
              </div>
            );
          })}

          {/* Divider */}
          <div style={styles.divider} />

          {/* Reverb row */}
          <div style={styles.row}>
            <button
              style={{ ...styles.reverbToggle, opacity: reverb > 0 ? 1 : 0.45 }}
              onClick={toggleReverb}
              title={reverb > 0 ? 'Reverb on — click to mute' : 'Reverb off — click to enable'}
            >
              🌊 Reverb {reverb > 0 ? 'ON' : 'OFF'}
            </button>
            <input
              type="range"
              min="0" max="1" step="0.05"
              value={reverb}
              onChange={e => handleReverb(e.target.value)}
              style={{ ...styles.slider, opacity: reverb > 0 ? 1 : 0.4 }}
            />
            <span style={styles.value}>{Math.round(reverb * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  root: {
    position:  'absolute',
    top:       16,
    right:     16,
    zIndex:    200,
    display:   'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap:        6,
    userSelect: 'none',
  },
  trigger: {
    display:      'flex',
    alignItems:   'center',
    gap:          6,
    background:   'rgba(0,0,0,0.65)',
    color:        '#fff',
    border:       `1px solid ${theme.colors.border}`,
    borderRadius: theme.radii.pill,
    padding:      '6px 14px',
    fontSize:     13,
    cursor:       'pointer',
    backdropFilter: 'blur(6px)',
  },
  reverbBadge: {
    background:   theme.colors.primary,
    color:        '#fff',
    fontSize:     10,
    fontWeight:   700,
    padding:      '1px 5px',
    borderRadius: 4,
  },
  caret: {
    fontSize:  10,
    opacity:   0.6,
    marginLeft: 2,
  },
  panel: {
    background:     'rgba(10,10,20,0.88)',
    border:         `1px solid ${theme.colors.border}`,
    borderRadius:   theme.radii.md,
    padding:        '12px 16px',
    minWidth:       240,
    display:        'flex',
    flexDirection:  'column',
    gap:            10,
    backdropFilter: 'blur(10px)',
  },
  row: {
    display:    'flex',
    alignItems: 'center',
    gap:        10,
  },
  label: {
    color:      '#fff',
    fontSize:   13,
    minWidth:   80,
    flexShrink: 0,
  },
  slider: {
    flex:        1,
    accentColor: theme.colors.primary,
    cursor:      'pointer',
  },
  value: {
    color:     theme.colors.textMuted,
    fontSize:  12,
    minWidth:  34,
    textAlign: 'right',
  },
  divider: {
    height:     1,
    background: theme.colors.border,
    margin:     '2px 0',
  },
  reverbToggle: {
    background:   'transparent',
    border:       `1px solid ${theme.colors.border}`,
    color:        '#fff',
    borderRadius: theme.radii.pill,
    padding:      '3px 10px',
    fontSize:     12,
    cursor:       'pointer',
    minWidth:     100,
    flexShrink:   0,
    transition:   'opacity 0.2s',
  },
};
