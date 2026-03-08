import { io } from 'socket.io-client';
import { useEffect, useRef, useState, useCallback } from 'react';

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

let sharedSocket = null;

function getSocket() {
  if (!sharedSocket) {
    sharedSocket = io(BASE_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
    });
  }
  return sharedSocket;
}

export function useSocket(pin) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
      if (pin) {
        socket.emit('session:join', { pin }, (resp) => {
          if (resp?.ok) setSessionId(resp.sessionId);
          else console.error('Failed to join session:', resp?.error);
        });
      }
    };

    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (!socket.connected) socket.connect();
    else onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [pin]);

  const emit = useCallback((event, data, ack) => {
    socketRef.current?.emit(event, data, ack);
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  return { socket: socketRef.current, connected, sessionId, emit, on };
}
