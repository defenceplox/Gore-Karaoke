import { useMemo } from 'react';
import theme from '../theme.js';

/**
 * Parses the UltraStar .txt format.
 *
 * Lines starting with ':' are notes:  ": beat duration pitch syllable"
 * Lines starting with '*' are golden notes (same format)
 * Lines starting with '-' are line breaks: "- beat"
 * Headers start with '#'
 */
export function parseUltraStarLyrics(txt) {
  const lines = txt.split('\n');
  const notes = [];
  let bpm = 120;
  let gap = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#BPM:'))  bpm = parseFloat(trimmed.slice(5).replace(',', '.'));
    if (trimmed.startsWith('#GAP:'))  gap = parseFloat(trimmed.slice(5));
    if (trimmed.startsWith(':') || trimmed.startsWith('*')) {
      const parts = trimmed.slice(1).trim().split(/\s+/);
      if (parts.length >= 4) {
        notes.push({
          beat:     parseInt(parts[0]),
          duration: parseInt(parts[1]),
          pitch:    parseInt(parts[2]),
          syllable: parts.slice(3).join(' '),
          golden:   trimmed[0] === '*',
        });
      }
    }
  }

  // Convert beats → milliseconds
  const msPerBeat = (60 / bpm / 4) * 1000;
  return notes.map(n => ({
    ...n,
    startMs: gap + n.beat * msPerBeat,
    endMs:   gap + (n.beat + n.duration) * msPerBeat,
  }));
}

/**
 * Parses LRC format (line-level timestamps from LRCLIB).
 * "[mm:ss.xx]Line text" → array of {startMs, endMs, syllable}
 * Each LRC line is treated as a single syllable (no word-level timing in
 * standard LRC, so the whole line highlights when it starts).
 */
export function parseLrcLyrics(lrc) {
  const lineRe = /^\[(\d{1,3}):(\d{2}\.\d{1,3})\](.*)$/;
  const entries = [];

  for (const raw of lrc.split('\n')) {
    const m = raw.trim().match(lineRe);
    if (!m) continue;
    const ms = (parseInt(m[1]) * 60 + parseFloat(m[2])) * 1000;
    const text = m[3].trim();
    if (text) entries.push({ ms, text });
  }

  // Convert to {startMs, endMs, syllable} — endMs = next line's startMs
  return entries.map((e, i) => ({
    startMs:   e.ms,
    endMs:     entries[i + 1]?.ms ?? e.ms + 5000,
    syllable:  e.text,
    golden:    false,
    lineBreak: true,  // each LRC entry is already a complete display line
  }));
}

/**
 * LyricsOverlay
 * Renders two lines of karaoke lyrics (current + next) with syllable-level
 * highlighting based on the current playback time.
 */
export default function LyricsOverlay({ lyricsData, currentTimeMs }) {
  const notes = useMemo(() => {
    if (!lyricsData) return [];
    if (Array.isArray(lyricsData)) return lyricsData; // already parsed
    if (typeof lyricsData === 'string') {
      // Auto-detect format by presence of LRC timestamp pattern
      if (/^\[\d{1,3}:\d{2}\./.test(lyricsData.trim())) {
        return parseLrcLyrics(lyricsData);
      }
      return parseUltraStarLyrics(lyricsData);
    }
    return [];
  }, [lyricsData]);

  // Group notes into display lines (split at large time gaps or line-break markers)
  const lines = useMemo(() => {
    if (!notes.length) return [];
    const groups = [];
    let current  = [];

    for (let i = 0; i < notes.length; i++) {
      current.push(notes[i]);
      const next = notes[i + 1];
      // Start a new line if: LRC line-break flag, or gap > 1s between syllables
      if (!next || notes[i].lineBreak || next.startMs - notes[i].endMs > 1000) {
        groups.push(current);
        current = [];
      }
    }
    if (current.length) groups.push(current);
    return groups;
  }, [notes]);

  // Find which line is current and next
  const currentLineIdx = useMemo(() => {
    for (let i = 0; i < lines.length; i++) {
      const last = lines[i][lines[i].length - 1];
      if (currentTimeMs <= last.endMs + 500) return i;
    }
    return lines.length - 1;
  }, [lines, currentTimeMs]);

  const renderLine = (lineNotes, isActive) =>
    lineNotes.map((note, i) => {
      const sung = currentTimeMs >= note.startMs;
      const singing = currentTimeMs >= note.startMs && currentTimeMs < note.endMs;

      return (
        <span
          key={i}
          style={{
            color:      sung ? theme.colors.primary : isActive ? '#fff' : 'rgba(255,255,255,0.4)',
            textShadow: singing
              ? `0 0 20px ${theme.colors.primaryGlow}, 0 0 40px ${theme.colors.primaryGlow}`
              : sung
                ? `0 0 10px ${theme.colors.primaryGlow}`
                : 'none',
            transition: 'color 0.05s, text-shadow 0.05s',
            fontWeight:  note.golden ? '900' : isActive ? '700' : '400',
          }}
        >
          {note.syllable}
        </span>
      );
    });

  const currentLine = lines[currentLineIdx];
  const nextLine    = lines[currentLineIdx + 1];

  return (
    <div style={{
      position:       'absolute',
      top:            0,
      bottom:         0,
      left:           0,
      right:          0,
      padding:        '0 48px',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      pointerEvents:  'none',
    }}>
      {/* Current line */}
      <div style={{
        fontSize:      'clamp(28px, 5vw, 56px)',
        lineHeight:    1.3,
        letterSpacing: '0.02em',
        marginBottom:  8,
        fontFamily:    theme.fonts.display,
        textShadow:    '2px 2px 8px rgba(0,0,0,0.8)',
        textAlign:     'center',
      }}>
        {currentLine ? renderLine(currentLine, true) : null}
      </div>

      {/* Next line (dimmed) */}
      <div style={{
        fontSize:      'clamp(20px, 3.5vw, 40px)',
        lineHeight:    1.3,
        letterSpacing: '0.02em',
        fontFamily:    theme.fonts.display,
        opacity:       0.5,
        textShadow:    '1px 1px 4px rgba(0,0,0,0.8)',
        textAlign:     'center',
      }}>
        {nextLine ? renderLine(nextLine, false) : null}
      </div>
    </div>
  );
}
