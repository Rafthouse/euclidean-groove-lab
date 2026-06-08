import * as Tone from 'tone';
import { audibleTracks, trackPattern } from './engine';
import type { Track, VoiceId } from './engine';

// The audio layer is a *consumer* of the engine: it never generates rhythm,
// it only plays whatever tracks the app feeds it.

// --- Voice instruments ---
// Each voice is a standalone instrument chain routed to the master output.

// Kick: deep low-end thump via tuned membrane synth
const kick = new Tone.MembraneSynth({
  pitchDecay: 0.05,
  octaves: 5,
  envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
}).toDestination();

// Snare (rimshot): white noise through a bandpass filter with a fast amplitude
// envelope — snappy, body-focused, no tonal component needed.
const snareNoise = new Tone.Noise({ type: 'white' });
const snareFilter = new Tone.Filter(2000, 'bandpass');
const snareEnv = new Tone.AmplitudeEnvelope({
  attack: 0.001,
  decay: 0.12,
  sustain: 0,
  release: 0.05,
}).toDestination();
snareNoise.connect(snareFilter);
snareFilter.connect(snareEnv);

// Hat: white noise through a highpass filter with a very short amplitude
// envelope — classic closed hi-hat.
const hatNoise = new Tone.Noise({ type: 'white' });
const hatFilter = new Tone.Filter(6000, 'highpass');
const hatEnv = new Tone.AmplitudeEnvelope({
  attack: 0.001,
  decay: 0.04,
  sustain: 0,
  release: 0.01,
}).toDestination();
hatNoise.connect(hatFilter);
hatFilter.connect(hatEnv);

// Bass: warm triangle-wave synth at E1, tuned for 16th-note groove
const bass = new Tone.Synth({
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.02, decay: 0.2, sustain: 0.15, release: 0.3 },
}).toDestination();

const voices: Record<VoiceId, (time: number) => void> = {
  kick: (time) => kick.triggerAttackRelease('C2', '8n', time),
  snare: (time) => {
    snareNoise.start(time);
    snareNoise.stop(time + 0.15);
    snareEnv.triggerAttackRelease('16n', time);
  },
  hat: (time) => {
    hatNoise.start(time);
    hatNoise.stop(time + 0.06);
    hatEnv.triggerAttackRelease('32n', time);
  },
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

export async function start(initial: Track[], bpm: number): Promise<void> {
  await Tone.start(); // resume AudioContext (requires a user gesture)
  currentTracks = initial;

  const transport = Tone.getTransport();
  transport.bpm.value = bpm;

  // One global step counter. Each track samples its own pattern via
  // `step % track.steps`, so tracks of different lengths drift naturally
  // against each other (honest polyrhythm, no per-track phase bookkeeping).
  let step = 0;
  transport.scheduleRepeat((time) => {
    for (const track of audibleTracks(currentTracks)) {
      const pulses = trackPattern(track).pulses;
      if (pulses[step % track.steps]) {
        voices[track.voiceId](time);
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