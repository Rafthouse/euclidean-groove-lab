import * as Tone from 'tone';
import { audibleTracks, trackPattern } from './engine';
import type { Track, VoiceId } from './engine';

// The audio layer is a *consumer* of the engine: it never generates rhythm,
// it only plays whatever tracks the app feeds it.

// Voice slots are fixed from Commit 1. All four currently invoke the same
// kick synth -- intentional, per docs/ARCHITECTURE.md, so Commit 2 becomes
// a swap and not a re-plumb of the audio graph.
const kick = new Tone.MembraneSynth().toDestination();
const voices: Record<VoiceId, (time: number) => void> = {
  kick: (time) => kick.triggerAttackRelease('C2', '8n', time),
  snare: (time) => kick.triggerAttackRelease('C2', '8n', time),
  hat: (time) => kick.triggerAttackRelease('C2', '8n', time),
  bass: (time) => kick.triggerAttackRelease('C2', '8n', time),
};

let currentTracks: Track[] = [];
let stepCallback: ((step: number) => void) | null = null;

/**
 * Atomic update of the playing track set. The scheduler reads `currentTracks`
 * by reference each tick, so a single assignment is enough -- no half-state.
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
