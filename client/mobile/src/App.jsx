import { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket.js';
import JoinPage    from './pages/JoinPage.jsx';
import SearchPage  from './pages/SearchPage.jsx';
import QueuePage   from './pages/QueuePage.jsx';
import MicPage     from './pages/MicPage.jsx';
import UploadPage  from './pages/UploadPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import TabBar      from './components/TabBar.jsx';
import theme       from './theme.js';

export default function App() {
  const [pin,         setPin]         = useState(null);
  const [singerName,  setSingerName]  = useState('');
  const [activeTab,   setActiveTab]   = useState('search');

  const { connected, sessionId, queue, nowPlaying, serverStopping, emit, on } = useSocket(pin);

  // Restore session from sessionStorage on reload
  useEffect(() => {
    const savedPin  = sessionStorage.getItem('karaoke-pin');
    const savedName = sessionStorage.getItem('karaoke-singer');
    if (savedPin && savedName) {
      setPin(savedPin);
      setSingerName(savedName);
    }
  }, []);

  const handleJoin = (joinPin, name) => {
    setPin(joinPin);
    setSingerName(name);
  };

  if (!pin) {
    return <JoinPage onJoin={handleJoin} />;
  }

  if (serverStopping) {
    return (
      <div style={styles.loading}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>⏸️</div>
        <p style={{ color: '#fff', fontWeight: 700, margin: '0 0 8px', fontSize: 17 }}>Server restarting…</p>
        <p style={{ color: theme.colors.textMuted, margin: 0, fontSize: 14 }}>Will reconnect automatically</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        <p style={{ color: theme.colors.textMuted, marginTop: 12 }}>Connecting…</p>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={{ fontSize: 20 }}>🎤</span>
          <span style={styles.headerTitle}>Karaoke</span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.singerBadge}>{singerName}</span>
          <span style={styles.pinBadge}>PIN {pin}</span>
        </div>
      </header>

      {/* Tab content */}
      <main style={styles.main}>
        {activeTab === 'search' && (
          <SearchPage
            pin={pin}
            singerName={singerName}
            emit={emit}
            onAdd={(q) => setActiveTab('queue')}
          />
        )}
        {activeTab === 'queue' && (
          <QueuePage
            pin={pin}
            queue={queue}
            nowPlaying={nowPlaying}
            emit={emit}
          />
        )}
        {activeTab === 'mic' && (
          <MicPage
            pin={pin}
            singerName={singerName}
            nowPlaying={nowPlaying}
            emit={emit}
            on={on}
          />
        )}
        {activeTab === 'history' && (
          <HistoryPage pin={pin} />
        )}
        {activeTab === 'upload' && (
          <UploadPage pin={pin} />
        )}
      </main>

      <TabBar
        activeTab={activeTab}
        onTab={setActiveTab}
        queueCount={queue.length}
      />
    </div>
  );
}

const styles = {
  app: {
    height:        '100dvh',
    display:       'flex',
    flexDirection: 'column',
    background:    theme.colors.bg,
    color:         theme.colors.text,
    fontFamily:    theme.fonts.ui,
    overflow:      'hidden',
  },
  header: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '10px 16px',
    background:     theme.colors.bgCard,
    borderBottom:   `1px solid ${theme.colors.border}`,
    flexShrink:     0,
    paddingTop:     'max(10px, env(safe-area-inset-top))',
  },
  headerLeft: {
    display:    'flex',
    alignItems: 'center',
    gap:        8,
  },
  headerTitle: {
    color:      '#fff',
    fontSize:   18,
    fontWeight: 700,
  },
  headerRight: {
    display:    'flex',
    alignItems: 'center',
    gap:        8,
  },
  singerBadge: {
    color:         theme.colors.primary,
    fontSize:      13,
    fontWeight:    600,
  },
  pinBadge: {
    background:   'rgba(255,255,255,0.07)',
    color:        theme.colors.textMuted,
    fontSize:     12,
    padding:      '3px 8px',
    borderRadius: theme.radii.pill,
    fontWeight:   600,
    letterSpacing: '0.05em',
  },
  main: {
    flex:     1,
    overflow: 'hidden',
    display:  'flex',
    flexDirection: 'column',
  },
  loading: {
    height:         '100dvh',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    background:     theme.colors.bg,
    color:          '#fff',
  },
  spinner: {
    width:  36,
    height: 36,
    border: '3px solid rgba(255,255,255,0.1)',
    borderTop: `3px solid ${theme.colors.primary}`,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
