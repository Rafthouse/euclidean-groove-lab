import * as Tone from 'tone';
import {
  audibleTracks,
  trackPattern,
  isPitchedVoice,
  isStepMuted,
  isActive,
  adjustedTick,
  localStep,
  onsetIndexAt,
  resolvePitchSpec,
} from './engine';
import type { Track, VoiceId, MidiNote, PlaybackMode, PlaybackSpeed } from './engine';
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

// --- Ghost lane (Snare) — a SEPARATE audio path so the ghost retrigger can
// never cut the main snare's transient. Source → HP → LP → destination.
// -24 dB/oct (Tone.Filter has no -18; -24 is the next steeper native slope).
const ghostHP = new Tone.Filter({ type: 'highpass', frequency: 200, rolloff: -24 });
const ghostLP = new Tone.Filter({ type: 'lowpass', frequency: 6000, rolloff: -24 });
ghostHP.connect(ghostLP);
ghostLP.toDestination();

// --- Drum kit (sample-based, swappable) ---
// POLYPHONIC, EVENT-DRIVEN model: we hold one BUFFER per voice (not a shared
// Player). Each hit spawns its OWN one-shot ToneBufferSource with the level
// baked in at trigger time, then auto-disposes. Consequences:
//   - No shared mutable voice state → editing velocity can never change a
//     note that is already sounding (its source/gain are frozen at trigger).
//   - No monophonic retrigger → fast hats/snare/ghost never choke each other.
//   - Level is applied AT the scheduled time (start(time, …, gain)), not
//     synchronously during the scheduler's look-ahead.
const SAMPLE_BASE = '/euclidean-groove-lab/samples/';

let buffers: {
  kick: Tone.ToneAudioBuffer;
  snare: Tone.ToneAudioBuffer;
  hat: Tone.ToneAudioBuffer;
} | null = null;

let currentKitId: DrumKitId = 'cr78';

/** Callback fired during kit loading: `true` = loading, `false` = done/error. */
let loadingCallback: ((busy: boolean) => void) | null = null;

export function onKitLoading(callback: (busy: boolean) => void): void {
  loadingCallback = callback;
}

/**
 * Fire a sample as an independent one-shot voice. The gain is frozen into THIS
 * trigger at `time` — nothing about a later edit or a later hit can reach back
 * and alter it. The source disposes itself when it finishes playing.
 */
function triggerSample(
  buffer: Tone.ToneAudioBuffer | undefined,
  time: number,
  level: number,
  destination: Tone.InputNode,
): void {
  if (!buffer || !buffer.loaded) return;
  const src = new Tone.ToneBufferSource(buffer);
  src.connect(destination);
  src.onended = () => src.dispose();
  // start(time, offset, duration, gain): gain is the per-source playback level.
  src.start(time, 0, undefined, clamp01(level));
}

/**
 * Load a drum kit: dispose previous buffers, fetch the new samples. Graceful
 * fallback: a sample that fails to load just stays silent; the app never
 * crashes. Buffers are shared by the main voices and the ghost lane.
 */
async function loadDrumKit(id: DrumKitId): Promise<void> {
  loadingCallback?.(true);

  // 1. Dispose old buffers
  if (buffers) {
    try {
      buffers.kick.dispose();
      buffers.snare.dispose();
      buffers.hat.dispose();
    } catch {
      // dispose may throw if already disposed; safe to ignore
    }
    buffers = null;
  }

  // 2. Build paths
  const kit = DRUM_KITS[id];
  const makeUrl = (p: string) => `${SAMPLE_BASE}${p}`;
  const silent = () => new Tone.ToneAudioBuffer(); // empty buffer, .loaded === false

  // 3. Load buffers in parallel; each failure degrades to a silent buffer.
  const [kick, snare, hat] = await Promise.all([
    Tone.ToneAudioBuffer.fromUrl(makeUrl(kit.kick)).catch(silent),
    Tone.ToneAudioBuffer.fromUrl(makeUrl(kit.snare)).catch(silent),
    Tone.ToneAudioBuffer.fromUrl(makeUrl(kit.hat)).catch(silent),
  ]);

  buffers = { kick, snare, hat };
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

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// Voices take `velocity` (per-hit dynamics, 0–1) and `volume` (per-track mixer
// level, 0–1). For the sample voices the effective level is volume × velocity,
// baked into a fresh one-shot source at trigger time — no shared node, no
// monophonic retrigger. `midi` is used only by the (pitched) bass voice.
const voices: Record<
  VoiceId,
  (time: number, velocity?: number, volume?: number, midi?: MidiNote) => void
> = {
  kick: (time, velocity = 1, volume = 1) =>
    triggerSample(buffers?.kick, time, volume * velocity, Tone.getDestination()),
  snare: (time, velocity = 1, volume = 1) =>
    triggerSample(buffers?.snare, time, volume * velocity, Tone.getDestination()),
  hat: (time, velocity = 1, volume = 1) =>
    triggerSample(buffers?.hat, time, volume * velocity, Tone.getDestination()),
  bass: (time, velocity = 1, volume = 1, midi) => {
    const note = midi !== undefined ? Tone.Frequency(midi, 'midi').toNote() : 'E2';
    // Bass is a monophonic synth; triggerAttackRelease already creates an
    // independent envelope per trigger with the velocity baked in. The mixer
    // level rides on the synth's output volume (changes with the Volume slider,
    // not per note).
    bass.volume.value = linearToDb(volume);
    bass.triggerAttackRelease(note, '8n', time, velocity);
  },
};

let currentTracks: Track[] = [];

/**
 * The single global step counter. Module-scoped so an external `resetClock()`
 * call can zero it without stopping Tone.Transport. Single-clock invariant is
 * preserved: this is the SAME `g` the scheduler advances, not a second source.
 */
let globalStep = 0;

/**
 * Reset the global cycle counter to 0 without touching Tone.Transport. The
 * transport keeps running (no stop/start glitch, no sample tail cut), but
 * every track restarts its cycle from origin on the very next 32n tick.
 * Swing is unaffected — it lives on Transport.position, not on `g`.
 */
export function resetClock(): void {
  globalStep = 0;
}

/** Per-track step callback shape: emits the GLOBAL clock `g` and the per-track
 * local step the resolver computed for that `g`. UI uses `g` for phaseOffset
 * math on user changes; the per-track map drives playhead rendering. */
export type StepCallback = (g: number, perTrack: Record<string, number>) => void;
let stepCallback: StepCallback | null = null;

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

/** Subscribe to the per-tick state (global clock + per-track local steps). */
export function onStep(callback: StepCallback): void {
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
  if (!buffers) {
    await loadDrumKit('cr78');
  }

  currentTracks = initial;

  const transport = Tone.getTransport();
  transport.bpm.value = bpm;

  // SINGLE-CLOCK MODEL.
  // One Tone.Transport, one module-scoped `globalStep`, master subdivision =
  // 32n. Each track is just a different INTERPRETATION of `globalStep`:
  //   isActive(g, speed) ∧ localStep(g, mode, speed, offset, N) → playback
  // Pure resolver in engine/playback.ts. No per-track timers, no accumulating
  // counters — by construction, polyrhythm cannot desynchronise. `resetClock`
  // zeros `globalStep`; the transport keeps running, so there's no click.
  globalStep = 0;
  transport.scheduleRepeat((time) => {
    const g = globalStep;
    const perTrack: Record<string, number> = {};
    for (const track of audibleTracks(currentTracks)) {
      const speed: PlaybackSpeed = track.playbackSpeed ?? 1;
      if (!isActive(g, speed)) continue; // this track has no event on this 32n tick

      const mode: PlaybackMode = track.playbackMode ?? 'forward';
      const offset = track.phaseOffset ?? 0;
      const step = localStep(g, mode, speed, offset, track.steps);
      if (step < 0) continue; // degenerate (N=0)
      perTrack[track.id] = step;

      const tp = trackPattern(track);
      if (!tp.pulses[step]) continue;
      if (isStepMuted(track, step)) continue; // manualMute is step-indexed → reverse safe

      // ──────────────────────────────────────────────────────────────────
      // MAIN NOTE PATH. The velocity of the main hit comes ONLY from the
      // Velocity Lane (`tp.velocities`, gated by `velocityEnabled`) or from
      // the per-onset PitchEvent. Nothing downstream is allowed to mutate it,
      // and the ghost path below MUST NOT read either of these variables.
      // ──────────────────────────────────────────────────────────────────
      const mainVolume = (track.volume ?? 100) / 100;

      // Ducking module is DISABLED per requirement (#5). The data model and
      // UI types stay so the lane can be revived later, but the scheduler
      // performs no modulation and records no source-side state.

      // Pitch module: gated by `pitchEnabled`. Only the bass voice exposes
      // this in the UI; the gate makes a track without an active pitch
      // module fall back to its intrinsic drum/voice behaviour.
      const pitchActive =
        track.pitchEnabled === true &&
        !!track.pitches &&
        track.pitches.slots.length > 0;

      if (isPitchedVoice(track.voiceId) && pitchActive) {
        // Pitch index advances LINEARLY through monotonic `t`, regardless of
        // playback mode — isorhythm variant (a): each played note = +1 in the
        // pitch cycle. Inlined here instead of going through resolveOnset()
        // so we can decouple "is this an audible onset?" (uses `step`, just
        // confirmed by tp.pulses above) from "which pitch slot is it?" (uses
        // `t`). engine/pitch.ts is not modified.
        const t = adjustedTick(g, speed, offset);
        const onsetIdx = onsetIndexAt(tp.pulses, t);
        const slot = track.pitches!.slots[onsetIdx % track.pitches!.slots.length];
        if (slot === null) continue; // explicit rest in the pitch cycle
        const midi = resolvePitchSpec(slot.pitch);
        const stepVel = tp.velocities ? tp.velocities[step] : undefined;
        const mainVelocity = (slot.velocity ?? stepVel ?? 100) / 100;
        voices[track.voiceId](time, mainVelocity, mainVolume, midi);
      } else {
        const mainVelocity = tp.velocities ? (tp.velocities[step] ?? 100) / 100 : 1;
        voices[track.voiceId](time, mainVelocity, mainVolume);
      }

      // ──────────────────────────────────────────────────────────────────
      // GHOST NOTE PATH (Snare only). Fires its OWN one-shot source from the
      // snare buffer, routed through the dedicated HP→LP filter chain — never
      // voices['snare'], never the main voice. Level (amount × track volume)
      // is frozen into the source at trigger time. The filter cutoffs come
      // from the module params; all GHOST-ONLY.
      // ──────────────────────────────────────────────────────────────────
      if (track.voiceId === 'snare' && track.ghost?.enabled) {
        if (buffers && Math.random() < clamp01(track.ghost.probability)) {
          const sixteenthSec = Tone.Time('16n').toSeconds();
          const ghostTime = time + sixteenthSec * Math.max(1, track.ghost.delaySteps);
          ghostHP.frequency.value = track.ghost.hpHz;
          ghostLP.frequency.value = track.ghost.lpHz;
          const ghostLevel = clamp01(track.ghost.amount / 100) * ((track.volume ?? 100) / 100);
          triggerSample(buffers.snare, ghostTime, ghostLevel, ghostHP);
        }
      }
    }
    Tone.getDraw().schedule(() => stepCallback?.(g, perTrack), time);
    globalStep += 1;
  }, '32n');

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