import theme from '../theme.js';

const TABS = [
  { id: 'search', label: 'Search',  icon: '🔍' },
  { id: 'queue',  label: 'Queue',   icon: '📋' },
  { id: 'mic',    label: 'Mic',     icon: '🎤', wip: true },
  { id: 'upload', label: 'Upload',  icon: '📤' },
];

export default function TabBar({ activeTab, onTab, queueCount }) {
  return (
    <nav style={styles.nav}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          disabled={tab.wip}
          style={{
            ...styles.tab,
            ...(tab.wip ? styles.tabDisabled : {}),
            borderTop: !tab.wip && activeTab === tab.id
              ? `2px solid ${theme.colors.primary}`
              : '2px solid transparent',
            color: tab.wip
              ? 'rgba(255,255,255,0.2)'
              : activeTab === tab.id ? theme.colors.primary : theme.colors.textMuted,
          }}
          onClick={() => !tab.wip && onTab(tab.id)}
        >
          <span style={styles.icon}>
            {tab.icon}
            {tab.id === 'queue' && queueCount > 0 && (
              <span style={styles.badge}>{queueCount > 9 ? '9+' : queueCount}</span>
            )}
            {tab.wip && <span style={styles.wipBadge}>WIP</span>}
          </span>
          <span style={styles.label}>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

const styles = {
  nav: {
    display:        'flex',
    background:     theme.colors.tabBar,
    borderTop:      `1px solid ${theme.colors.border}`,
    flexShrink:     0,
    paddingBottom:  'env(safe-area-inset-bottom)',
  },
  tab: {
    flex:           1,
    padding:        '10px 4px 8px',
    background:     'none',
    border:         'none',
    cursor:         'pointer',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    gap:            3,
  },
  icon: {
    fontSize:  22,
    position:  'relative',
    lineHeight: 1,
  },
  label: {
    fontSize:  11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  badge: {
    position:   'absolute',
    top:        -4,
    right:      -8,
    background: theme.colors.primary,
    color:      '#fff',
    fontSize:   9,
    fontWeight: 900,
    borderRadius: '999px',
    padding:    '1px 5px',
    lineHeight: '14px',
  },
  wipBadge: {
    position:      'absolute',
    top:           -4,
    right:         -10,
    background:    'rgba(255,255,255,0.15)',
    color:         'rgba(255,255,255,0.4)',
    fontSize:      8,
    fontWeight:    700,
    padding:       '1px 4px',
    borderRadius:  3,
    letterSpacing: '0.05em',
  },
  tabDisabled: {
    cursor: 'default',
    filter: 'grayscale(1)',
  },
};
