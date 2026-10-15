// Web Audio API tactile sound utility for low-latency UI micro-interactions
let audioCtx: AudioContext | null = null;
let soundBuffer: AudioBuffer | null = null;
let isLoading = false;

async function initAudio() {
  if (soundBuffer || isLoading || typeof window === 'undefined') return;
  isLoading = true;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    const response = await fetch('/tap-sound.mp3');
    const arrayBuffer = await response.arrayBuffer();
    soundBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch {
    // Graceful fallback to HTMLAudioElement
  } finally {
    isLoading = false;
  }
}

// Fallback HTMLAudioElement pool
const audioPool: HTMLAudioElement[] = [];
const POOL_SIZE = 4;
let poolIndex = 0;

function getFallbackAudio(): HTMLAudioElement {
  if (audioPool.length < POOL_SIZE) {
    const a = new Audio('/tap-sound.mp3');
    a.volume = 0.45;
    audioPool.push(a);
    return a;
  }
  const a = audioPool[poolIndex];
  poolIndex = (poolIndex + 1) % POOL_SIZE;
  return a;
}

let isSoundMuted = false;

if (typeof window !== 'undefined') {
  try {
    isSoundMuted = localStorage.getItem('portfolio_sound_muted') === 'true';
  } catch {
    isSoundMuted = false;
  }
}

export function isMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return isSoundMuted;
}

export function toggleSound(): boolean {
  if (typeof window === 'undefined') return false;
  isSoundMuted = !isSoundMuted;
  try {
    localStorage.setItem('portfolio_sound_muted', isSoundMuted ? 'true' : 'false');
  } catch {}
  window.dispatchEvent(new CustomEvent('sound-toggle', { detail: { muted: isSoundMuted } }));
  if (!isSoundMuted) {
    playTapSound(0.45);
  }
  return isSoundMuted;
}

export function setMuted(muted: boolean) {
  if (typeof window === 'undefined') return;
  isSoundMuted = muted;
  try {
    localStorage.setItem('portfolio_sound_muted', isSoundMuted ? 'true' : 'false');
  } catch {}
  window.dispatchEvent(new CustomEvent('sound-toggle', { detail: { muted: isSoundMuted } }));
}

export function playTapSound(volume = 0.45) {
  if (typeof window === 'undefined' || isSoundMuted) return;

  // 1. Zero-latency Web Audio API
  if (audioCtx && soundBuffer) {
    try {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      const source = audioCtx.createBufferSource();
      source.buffer = soundBuffer;
      const gain = audioCtx.createGain();
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(audioCtx.destination);
      source.start(0);
      return;
    } catch {
      // Fall through to HTMLAudio
    }
  }

  // Preload buffer for subsequent interactions
  if (!soundBuffer && !isLoading) {
    initAudio();
  }

  // 2. Fallback via HTMLAudioElement
  try {
    const a = getFallbackAudio();
    a.volume = volume;
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {
    // Autoplay policy or unsupported format
  }
}

// Pre-warm on initial interaction
if (typeof window !== 'undefined') {
  const triggerWarmup = () => {
    initAudio();
    window.removeEventListener('pointerdown', triggerWarmup);
    window.removeEventListener('pointermove', triggerWarmup);
    window.removeEventListener('keydown', triggerWarmup);
  };
  window.addEventListener('pointerdown', triggerWarmup, { once: true, passive: true });
  window.addEventListener('pointermove', triggerWarmup, { once: true, passive: true });
  window.addEventListener('keydown', triggerWarmup, { once: true, passive: true });
}
