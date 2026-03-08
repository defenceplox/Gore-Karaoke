/**
 * Web Audio API mixer
 * Manages multiple audio sources (track + physical mic channels + WebRTC phone mics)
 * and routes them through a shared output chain with reverb and compression.
 */

let ctx = null;
let masterGain = null;
let compressor = null;
let reverbNode  = null;
let reverbGain  = null;
let dryGain     = null;

const micChannels = new Map(); // peerId/deviceId → { source, gain }

function getContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Output chain: dryGain/reverbGain → master → compressor → destination
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value      = 6;
    compressor.ratio.value     = 4;
    compressor.attack.value    = 0.003;
    compressor.release.value   = 0.25;
    compressor.connect(ctx.destination);

    masterGain = ctx.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(compressor);

    dryGain = ctx.createGain();
    dryGain.gain.value = 1.0;
    dryGain.connect(masterGain);

    reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.0; // Reverb off by default
    reverbGain.connect(masterGain);

    loadReverb();
  }
  return ctx;
}

async function loadReverb() {
  // Simple synthetic reverb using a noise impulse response
  const context = getContext();
  const length  = context.sampleRate * 2.5;
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
    }
  }
  reverbNode = context.createConvolver();
  reverbNode.buffer = impulse;
  reverbNode.connect(reverbGain);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function resume() {
  getContext().resume();
}

/** Connect an HTMLAudioElement (mp3 track playback) */
export function connectAudioElement(audioEl) {
  const context = getContext();
  const source  = context.createMediaElementSource(audioEl);
  source.connect(dryGain);
  return source;
}

/** Add a microphone stream (physical mic or WebRTC phone mic) */
export function addMic(id, stream, initialGain = 1.0) {
  const context = getContext();
  if (micChannels.has(id)) removeMic(id);

  const source = context.createMediaStreamSource(stream);
  const gain   = context.createGain();
  gain.gain.value = initialGain;

  source.connect(gain);

  // Route through reverb
  const splitter = context.createChannelSplitter(1);
  gain.connect(dryGain);
  gain.connect(reverbNode || dryGain); // fallback if reverb not loaded yet

  micChannels.set(id, { source, gain });
  console.log(`🎤 Mic added: ${id}`);
  return { source, gain };
}

export function removeMic(id) {
  const ch = micChannels.get(id);
  if (!ch) return;
  try {
    ch.source.disconnect();
    ch.gain.disconnect();
  } catch {}
  micChannels.delete(id);
  console.log(`🎤 Mic removed: ${id}`);
}

export function setMicGain(id, value) {
  const ch = micChannels.get(id);
  if (ch) ch.gain.gain.linearRampToValueAtTime(value, getContext().currentTime + 0.1);
}

export function setMasterGain(value) {
  getContext();
  masterGain.gain.linearRampToValueAtTime(value, ctx.currentTime + 0.1);
}

export function setReverbAmount(value) {
  // value 0–1
  getContext();
  reverbGain.gain.linearRampToValueAtTime(value * 0.6,  ctx.currentTime + 0.1);
  dryGain.gain.linearRampToValueAtTime(1.0 - value * 0.3, ctx.currentTime + 0.1);
}

export function getMicIds() {
  return [...micChannels.keys()];
}
