import * as Tone from 'tone';
import { audibleTracks, trackPattern, resolveOnset } from './engine';
import type { Track, VoiceId, MidiNote } from './engine';
import { DRUM_KITS } from './drumKits';
import type { DrumKitId } from './drumKits';

// The audio layer is a *consumer* of the engine: it never generates rhythm,
// it only plays whatever tracks the app feeds it.

// --- Bass instrument (synthesized, not sampled) ---
// Sawtooth MonoSynth with static lowpass filter — pick-bass character
// with rich harmonics, no filter envelope sweep.
const BASS_FILTER_FREQ = 800;
const bass = new Tone.MonoSynth({
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 0.008, decay: 0.25, sustain: 0.2, release: 0.3 },
  filter: { type: 'lowpass', Q: 0.7, frequency: BASS_FILTER_FREQ, rolloff: -12 },
}).toDestination();

// --- Drum kit (sample-based, swappable) ---
const SAMPLE_BASE = '/euclidean-groove-lab/samples/';

let currentPlayers: {
  kick: Tone.Player;
  snare: Tone.Player;
  hat: Tone.Player;
} | null = null;

let currentKitId: DrumKitId = 'cr78';

/** Callback fired during kit loading: `true` = loading, `false` = done/error. */
let loadingCallback: ((busy: boolean) => void) | null = null;

export function onKitLoading(callback: (busy: boolean) => void): void {
  loadingCallback = callback;
}

/**
 * Load a drum kit: dispose previous Players, create new ones, fetch audio.
 * Graceful fallback: if a sample fails to load, the kit is still usable
 * (silent on that voice) and the app never crashes.
 */
async function loadDrumKit(id: DrumKitId): Promise<void> {
  loadingCallback?.(true);

  // 1. Dispose old players
  if (currentPlayers) {
    try {
      currentPlayers.kick.dispose();
      currentPlayers.snare.dispose();
      currentPlayers.hat.dispose();
    } catch {
      // dispose may throw if already disposed; safe to ignore
    }
    currentPlayers = null;
  }

  // 2. Build paths
  const kit = DRUM_KITS[id];
  const makeUrl = (p: string) => `${SAMPLE_BASE}${p}`;

  // 3. Create new Players (no URL yet — load manually for promise control)
    const kick = new Tone.Player().toDestination();
    const snare = new Tone.Player().toDestination();
    const hat = new Tone.Player().toDestination();

    // 4. Load in parallel — each failure caught individually
    await Promise.allSettled([
      kick.load(makeUrl(kit.kick)).catch(() => {}),
      snare.load(makeUrl(kit.snare)).catch(() => {}),
      hat.load(makeUrl(kit.hat)).catch(() => {}),
    ]);

  currentPlayers = { kick, snare, hat };
  currentKitId = id;
  loadingCallback?.(false);
}

/** Public API: switch the active drum kit without restarting Transport. */
export async function switchDrumKit(id: DrumKitId): Promise<void> {
  await loadDrumKit(id);
}

export function getCurrentKitId(): DrumKitId {
  return currentKitId;
}

// --- Voice dispatch ---

/** Normalize 0–100 → dB gain (0 = -∞, 100 = 0 dB). */
function linearToDb(normalized: number): number {
  if (normalized <= 0) return -Infinity;
  return 20 * Math.log10(normalized);
}

// Voices take an optional `midi`. Drum voices ignore it (they play a sample);
// the bass voice plays the resolved pitch, falling back to its intrinsic E2
// when the track has no pitch layer (per docs reconciliation D8).
const voices: Record<
  VoiceId,
  (time: number, velocity?: number, midi?: MidiNote) => void
> = {
  kick: (time) => currentPlayers?.kick.start(time),
  snare: (time, velocity = 1) => {
    const p = currentPlayers?.snare;
    if (!p) return;
    if (velocity < 1) p.volume.value = linearToDb(velocity);
    p.start(time);
  },
  hat: (time, velocity = 1) => {
    const p = currentPlayers?.hat;
    if (!p) return;
    p.volume.value = linearToDb(velocity);
    p.start(time);
  },
  bass: (time, velocity = 1, midi) => {
    const note = midi !== undefined ? Tone.Frequency(midi, 'midi').toNote() : 'E2';
    bass.triggerAttackRelease(note, '8n', time, velocity);
  },
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

/**
 * Apply swing to the groove. `amount` ranges 0 (straight) to 1 (maximum
 * shuffle). The subdivision is fixed to 8th notes because that is where
 * swing is musically expected and audible for our patterns: it delays the
 * off-beat 8ths (the "and" of each beat — steps 2, 6, 10, 14 on a 16-step
 * bar), which is exactly where the default hi-hat and other 8th-note voices
 * land. A 16th-note subdivision would only shift the odd 16th steps, which
 * the default 8th-note patterns never occupy, making the effect inaudible.
 */
export function setSwing(amount: number): void {
  const transport = Tone.getTransport();
  transport.swing = amount;
  transport.swingSubdivision = '8n';
}

/** Subscribe to the global step counter (drawn on the visual frame). */
export function onStep(callback: (step: number) => void): void {
  stepCallback = callback;
}

/**
 * Prime the iOS audio session for playback.
 */
function primeAudioSession(): void {
  try {
    if (
      typeof navigator !== 'undefined' &&
      (navigator as any).audioSession
    ) {
      (navigator as any).audioSession.type = 'playback';
      return;
    }
  } catch {
    // fall through
  }

  // Silent WAV fallback
  try {
    const sampleRate = 8000;
    const numSamples = sampleRate * 0.05;
    const dataLen = numSamples * 2;
    const wavBuffer = new ArrayBuffer(44 + dataLen);
    const view = new DataView(wavBuffer);
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataLen, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, dataLen, true);

    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.src = url;
    audio.loop = false;
    audio.volume = 0;
    audio.setAttribute('playsinline', '');
    audio.play().catch(() => {});
    setTimeout(() => URL.revokeObjectURL(url), 500);
  } catch {
    // non-critical
  }
}

export async function start(initial: Track[], bpm: number): Promise<void> {
  primeAudioSession();
  await Tone.start();

  // Load default drum kit on first start
  if (!currentPlayers) {
    await loadDrumKit('cr78');
  }

  currentTracks = initial;

  const transport = Tone.getTransport();
  transport.bpm.value = bpm;

  // One global step counter. resolveOnset() folds three things into one call:
  // the rhythmic onset test, the onset-indexed pitch lookup (isorhythm), and
  // the velocity precedence (event > step accent > default). It returns null
  // when nothing should sound — no onset here, or a rest slot in the pitch
  // sequence — so a single guard covers both silences.
  let step = 0;
  transport.scheduleRepeat((time) => {
    for (const track of audibleTracks(currentTracks)) {
      const tp = trackPattern(track);
      const onset = resolveOnset(track, tp, step);
      if (onset) {
        voices[track.voiceId](time, onset.velocity / 100, onset.midi);
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

if (typeof window !== 'undefined') {
  const ctx = (Tone.getContext() as any)._context as AudioContext | undefined;
  if (ctx && typeof ctx.onstatechange !== 'undefined') {
    ctx.onstatechange = () => {
      if (ctx.state === 'interrupted' || ctx.state === 'suspended') {
        ctx.resume().catch(() => {
          console.warn('AudioContext was suspended/interrupted and resume() failed.');
        });
      }
    };
  }
}