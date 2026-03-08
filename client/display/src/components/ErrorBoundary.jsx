import { Component } from 'react';
import theme from '../theme.js';

/**
 * Top-level error boundary for the display client.
 * Catches any uncaught React render errors and shows a recovery screen
 * instead of a blank TV display.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, countdown: 15 };
    this._timer = null;
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  componentDidUpdate(_, prev) {
    if (this.state.error && !prev.error) {
      // Auto-reload countdown
      this._timer = setInterval(() => {
        this.setState(s => {
          if (s.countdown <= 1) {
            clearInterval(this._timer);
            window.location.reload();
            return s;
          }
          return { countdown: s.countdown - 1 };
        });
      }, 1000);
    }
  }

  componentWillUnmount() {
    clearInterval(this._timer);
  }

  render() {
    const { error, countdown } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={styles.root}>
        <div style={styles.icon}>💥</div>
        <h1 style={styles.heading}>Something went wrong</h1>
        <p style={styles.message}>{error.message}</p>
        <p style={styles.sub}>Reloading in {countdown}s…</p>
        <button style={styles.btn} onClick={() => window.location.reload()}>
          Reload Now
        </button>
      </div>
    );
  }
}

const styles = {
  root: {
    width:           '100vw',
    height:          '100vh',
    background:      '#0a0a12',
    display:         'flex',
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             16,
    fontFamily:      theme.fonts.display,
    padding:         40,
    boxSizing:       'border-box',
    textAlign:       'center',
  },
  icon:    { fontSize: 72 },
  heading: { color: '#fff', fontSize: 36, margin: 0, fontWeight: 700 },
  message: { color: theme.colors.primary, fontSize: 18, margin: 0, maxWidth: 640 },
  sub:     { color: theme.colors.textMuted, fontSize: 16, margin: 0 },
  btn: {
    marginTop:    8,
    padding:      '12px 32px',
    background:   theme.colors.primary,
    color:        '#fff',
    border:       'none',
    borderRadius: theme.radii.pill,
    fontSize:     18,
    fontWeight:   600,
    cursor:       'pointer',
  },
};
