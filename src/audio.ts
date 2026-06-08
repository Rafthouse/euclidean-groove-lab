import * as Tone from 'tone';
import { audibleTracks, trackPattern } from './engine';
import type { Track, VoiceId } from './engine';

// The audio layer is a *consumer* of the engine: it never generates rhythm,
// it only plays whatever tracks the app feeds it.

// --- Voice instruments ---

// Kick: deep low-end thump via tuned membrane synth
const kick = new Tone.MembraneSynth({
  pitchDecay: 0.05,
  octaves: 5,
  envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
}).toDestination();

// Snare: pink noise through bandpass filter with snappy envelope —
// the filter gives mid-frequency focus for a snare-drum character
// without relying on samples.
const snare = new Tone.NoiseSynth({
  noise: { type: 'pink' },
  envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.04 },
});
const snareFilter = new Tone.Filter(2000, 'bandpass').toDestination();
snare.connect(snareFilter);

// Hat: FM-based metal synth with very short envelope — closed hi-hat character
const hat = new Tone.MetalSynth({
  harmonicity: 5.1,
  modulationIndex: 32,
  octaves: 1.5,
  resonance: 4000,
  envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 },
}).toDestination();

// Bass: triangle-wave MonoSynth with filter envelope — warm pick-bass character
const bass = new Tone.MonoSynth({
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 0.4 },
  filter: { type: 'lowpass', Q: 1, frequency: 800, rolloff: -12 },
  filterEnvelope: {
    attack: 0.005,
    decay: 0.15,
    sustain: 0.2,
    release: 0.4,
    baseFrequency: 300,
    octaves: 3,
    exponent: 2,
  },
}).toDestination();

const voices: Record<VoiceId, (time: number, velocity?: number) => void> = {
  kick: (time) => kick.triggerAttackRelease('C2', '8n', time),
  snare: (time) => snare.triggerAttackRelease('16n', time),
  hat: (time, velocity = 1) => hat.triggerAttackRelease('C4', '16n', time, velocity),
  bass: (time) => bass.triggerAttackRelease('E2', '8n', time),
};

let currentTracks: Track[] = [];
let stepCallback: ((step: number) => void) | null = null;

/**
 * Atomic update of the playing track set. The scheduler reads `currentTracks`
 * by reference each tick, so a single assignment is enough — no half-state.
 */
export function setTracks(next: Track[]): void {
  currentTracks = next;
}

export function setBpm(bpm: number): void {
  Tone.getTransport().bpm.value = bpm;
}

/** Subscribe to the global step counter (drawn on the visual frame). */
export function onStep(callback: (step: number) => void): void {
  stepCallback = callback;
}

/**
 * Prime the iOS audio session for playback.
 *
 * On iOS, Web Audio runs under AVAudioSessionCategoryAmbient by default,
 * which is muted by the hardware ring/silent switch. In WKWebView (Telegram
 * in-app browser) this means total silence. We flip it to "playback" so
 * sound is audible regardless of the mute switch.
 *
 * On iOS 17+ we use navigator.audioSession. On older iOS we prime with a
 * silent WAV via an <audio> element, which forces the session to playback.
 */
function primeAudioSession(): void {
  // iOS 17+ native API
  try {
    if (
      typeof navigator !== 'undefined' &&
      (navigator as any).audioSession
    ) {
      (navigator as any).audioSession.type = 'playback';
      return;
    }
  } catch {
    // API exists but may throw in some contexts; fall through
  }

  // Fallback: silent WAV priming (44-byte header + silence samples)
  try {
    const sampleRate = 8000;
    const numSamples = sampleRate * 0.05; // 50 ms of silence
    const dataLen = numSamples * 2; // 16-bit mono
    const wavBuffer = new ArrayBuffer(44 + dataLen);
    const view = new DataView(wavBuffer);

    // RIFF header
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataLen, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);        // chunk size
    view.setUint16(20, 1, true);         // PCM
    view.setUint16(22, 1, true);         // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true);         // block align
    view.setUint16(34, 16, true);        // bits per sample
    writeStr(36, 'data');
    view.setUint32(40, dataLen, true);
    // samples are already zero (ArrayBuffer zeros by default)

    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.src = url;
    audio.loop = false;
    audio.volume = 0;
    audio.setAttribute('playsinline', '');
    audio.play().catch(() => {}); // fire-and-forget; may fail in some contexts
    // Clean up the object URL after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 500);
  } catch {
    // Silent WAV priming failed — non-critical, audio may still work
  }
}

export async function start(initial: Track[], bpm: number): Promise<void> {
  // 1. Prime audio session (iOS / WKWebView)
  primeAudioSession();

  // 2. Resume AudioContext (requires a user gesture)
  await Tone.start();

  currentTracks = initial;

  const transport = Tone.getTransport();
  transport.bpm.value = bpm;

  // One global step counter. Each track samples its own pattern via
  // `step % track.steps`, so tracks of different lengths drift naturally
  // against each other (honest polyrhythm, no per-track phase bookkeeping).
  let step = 0;
  transport.scheduleRepeat((time) => {
    for (const track of audibleTracks(currentTracks)) {
      const tp = trackPattern(track);
      if (tp.pulses[step % track.steps]) {
        const velocity = tp.velocities
          ? (tp.velocities[step % track.steps] ?? 100) / 100
          : 1;
        voices[track.voiceId](time, velocity);
      }
    }
    Tone.getDraw().schedule(() => stepCallback?.(step), time);
    step += 1;
  }, '16n');

  transport.start();
}

export function stop(): void {
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();
  Tone.getDraw().cancel();
}

// --- iOS AudioContext lifecycle handling ---

/**
 * Monitor AudioContext state changes and auto-resume when returning from
 * background (iOS suspends/interrupts the context).
 */
if (typeof window !== 'undefined') {
  const ctx = (Tone.getContext() as any)._context as AudioContext | undefined;
  if (ctx && typeof ctx.onstatechange !== 'undefined') {
    ctx.onstatechange = () => {
      if (ctx.state === 'interrupted' || ctx.state === 'suspended') {
        ctx.resume().catch(() => {
          // Audio context couldn't resume automatically; user may need to
          // tap Play again after returning to the tab.
          console.warn('AudioContext was suspended/interrupted and resume() failed.');
        });
      }
    };
  }
}