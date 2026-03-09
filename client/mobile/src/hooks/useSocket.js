import { io } from 'socket.io-client';
import { useEffect, useRef, useState, useCallback } from 'react';

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';
let sharedSocket = null;

function getSocket() {
  if (!sharedSocket) {
    sharedSocket = io(BASE_URL, { autoConnect: false, reconnection: true });
  }
  return sharedSocket;
}

export function useSocket(pin) {
  const socketRef = useRef(null);
  const [connected,      setConnected]      = useState(false);
  const [sessionId,      setSessionId]      = useState(null);
  const [queue,          setQueue]          = useState([]);
  const [nowPlaying,     setNowPlaying]     = useState(null);
  const [serverStopping, setServerStopping] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
      if (pin) {
        socket.emit('session:join', { pin }, (resp) => {
          if (resp?.ok) {
            setSessionId(resp.sessionId);
            setQueue(resp.queue || []);
            setNowPlaying(resp.nowPlaying || null);
          }
        });
      }
    };

    const onDisconnect = () => setConnected(false);

    const onQueueUpdate    = ({ queue: q })           => setQueue(q);
    const onPlaybackStart  = ({ nowPlaying: np, queue: q }) => {
      setNowPlaying(np);
      setQueue(q);
    };
    const onServerShutdown = () => setServerStopping(true);

    socket.on('connect',          onConnect);
    socket.on('disconnect',       onDisconnect);
    socket.on('queue:update',     onQueueUpdate);
    socket.on('playback:started', onPlaybackStart);
    socket.on('server:shutdown',  onServerShutdown);

    if (!socket.connected) socket.connect();
    else onConnect();

    return () => {
      socket.off('connect',          onConnect);
      socket.off('disconnect',       onDisconnect);
      socket.off('queue:update',     onQueueUpdate);
      socket.off('playback:started', onPlaybackStart);
      socket.off('server:shutdown',  onServerShutdown);
    };
  }, [pin]);

  const emit = useCallback((event, data, ack) => {
    socketRef.current?.emit(event, data, ack);
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  return { socket: socketRef.current, connected, sessionId, queue, nowPlaying, serverStopping, emit, on };
}
