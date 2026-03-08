import { Component } from 'react';
import theme from '../theme.js';

/**
 * Top-level error boundary for the mobile client.
 * Catches any uncaught React render errors and shows a recovery screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={styles.root}>
        <div style={styles.icon}>💥</div>
        <h2 style={styles.heading}>Something went wrong</h2>
        <p style={styles.message}>{error.message}</p>
        <button style={styles.btn} onClick={() => window.location.reload()}>
          Tap to Reload
        </button>
      </div>
    );
  }
}

const styles = {
  root: {
    width:          '100vw',
    height:         '100vh',
    background:     theme.colors.bgPage ?? '#1a1a2e',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            14,
    padding:        32,
    boxSizing:      'border-box',
    textAlign:      'center',
  },
  icon:    { fontSize: 56 },
  heading: { color: '#fff', fontSize: 22, margin: 0, fontWeight: 700 },
  message: { color: theme.colors.primary, fontSize: 14, margin: 0, maxWidth: 340 },
  btn: {
    marginTop:    8,
    padding:      '12px 28px',
    background:   theme.colors.primary,
    color:        '#fff',
    border:       'none',
    borderRadius: theme.radii.pill,
    fontSize:     16,
    fontWeight:   600,
    cursor:       'pointer',
  },
};
