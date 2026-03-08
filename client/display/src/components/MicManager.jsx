import { useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import { addMic, removeMic } from '../audio/mixer.js';

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

/**
 * MicManager
 * Invisible component that manages:
 * 1. Physical microphone (captured on the host device via getUserMedia)
 * 2. Phone mic peers (received via WebRTC/PeerJS, initiated from mobile client)
 */
export default function MicManager({ pin, onMicsChange }) {
  const peerRef    = useRef(null);
  const physMicRef = useRef(null);

  // ── Physical mic ────────────────────────────────────────────────────────────
  useEffect(() => {
    let stream = null;

    navigator.mediaDevices
      ?.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false })
      .then(s => {
        stream = s;
        physMicRef.current = addMic('physical', stream, 1.0);
        onMicsChange?.(['physical']);
        console.log('🎙️ Physical mic connected');
      })
      .catch(err => {
        console.warn('Physical mic not available:', err.message);
      });

    return () => {
      stream?.getTracks().forEach(t => t.stop());
      removeMic('physical');
    };
  }, []);

  // ── PeerJS (phone mics) ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!pin) return;

    const peer = new Peer(`display-${pin}`, {
      host:   window.location.hostname,
      port:   Number(window.location.port) || (window.location.protocol === 'https:' ? 443 : 80),
      path:   '/peerjs',
      secure: window.location.protocol === 'https:',
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });

    peerRef.current = peer;

    peer.on('open', (id) => console.log(`📡 PeerJS ready: ${id}`));

    peer.on('call', (call) => {
      call.answer(); // No stream back — this is receive-only
      call.on('stream', (remoteStream) => {
        addMic(call.peer, remoteStream, 1.0);
        onMicsChange?.(prev =>
          Array.isArray(prev) ? [...new Set([...prev, call.peer])] : [call.peer]
        );
        console.log(`📱 Phone mic stream received from ${call.peer}`);
      });
      call.on('close', () => {
        removeMic(call.peer);
        onMicsChange?.(prev =>
          Array.isArray(prev) ? prev.filter(id => id !== call.peer) : prev
        );
      });
    });

    peer.on('error', (err) => console.error('PeerJS error:', err));

    return () => {
      peer.destroy();
      peerRef.current = null;
    };
  }, [pin]);

  return null; // No UI — purely functional
}
