import type { Pattern } from './types';
import type { PitchSequence } from './pitch';
import { euclid } from './euclidean';
import { rotate } from './rotate';

/**
 * One of four fixed voice slots.
 */
export type VoiceId = 'kick' | 'snare' | 'hat' | 'bass';

/**
 * A cyclic velocity pattern applied per onset index.
 * Values: 0–100 (percent), cycles over the track's onsets.
 */
export type VelocityPattern = number[];

/**
 * Standard velocity ramp patterns (0–100 scale).
 * Indexed by mode number (1-based).
 */
export const VELOCITY_PRESETS: Record<number, VelocityPattern> = {
  1: [100],
  2: [100, 80],
  3: [80, 90, 100],
  4: [80, 86, 94, 100],
  5: [80, 85, 90, 95, 100],
};

/**
 * A track's identity and rhythmic configuration. The pattern itself is
 * derived (see `trackPattern`), never stored: groove is emergent, never a
 * primitive, per the contract in docs/ARCHITECTURE.md.
 */
export interface Track {
  id: string;
  name: string;
  color: string;

  steps: number;
  hits: number;
  rotation: number;

  mute: boolean;
  solo: boolean;

  voiceId: VoiceId;

  /** Per-track mixer level, 0–100 (default 100). Audio-only; not exported to MIDI. */
  volume?: number;

  /** Optional cyclic velocity sequence indexed by onset order (not step index). */
  velocityPattern?: VelocityPattern;

  /**
   * Optional pitch layer — an independent, onset-indexed cycle (isorhythm).
   * Absent => drum-style (no pitch). See docs/PITCH-DATA-MODEL-RECONCILIATION.md.
   */
  pitches?: PitchSequence;
}

/**
 * The per-track carrier that grows over time.
 */
export interface TrackPattern {
  pulses: Pattern;
  accents?: number[];
  velocities?: number[];
  microtiming?: number[];
}

/**
 * Derive a track's playable pattern.
 */
export function trackPattern(track: Track): TrackPattern {
  const pulses = rotate(euclid(track.hits, track.steps), track.rotation);
  const velocities = track.velocityPattern
    ? computeVelocities(pulses, track.velocityPattern)
    : undefined;
  return { pulses, velocities };
}

/**
 * Compute per-onset velocity values from a cyclic pattern.
 *
 * Walks the pulse array by onset index (not step index): each `true` in
 * `pulses` consumes one entry from `pattern` cyclically; `false` entries
 * get velocity 0 (silent).
 */
export function computeVelocities(
  pulses: boolean[],
  pattern: number[],
): number[] {
  if (pattern.length === 0) return pulses.map(() => 0);
  let onsetIndex = 0;
  return pulses.map((on) => {
    if (!on) return 0;
    const v = pattern[onsetIndex % pattern.length];
    onsetIndex++;
    return v;
  });
}

/**
 * Solo-takes-priority filter: if any track is soloed, only soloed tracks are
 * audible (and `mute` is ignored within the solo set, per contract); if no
 * track is soloed, audible tracks are the non-muted ones. This matches the
 * universal grooveboxes/DAWs convention: SOLO is a positive selector and
 * overrides MUTE within its scope.
 */
export function audibleTracks(tracks: readonly Track[]): Track[] {
  const anySolo = tracks.some((t) => t.solo);
  return anySolo ? tracks.filter((t) => t.solo) : tracks.filter((t) => !t.mute);
}

/**
 * Seed state for the four-track kit. Defaults chosen so that hitting Play
 * yields something musical immediately, not a clinical metronome.
 *
 * These are *defaults*, not a preset. A `Preset` is a named multi-track
 * snapshot (Commit 3). Defaults are the bootstrap state of an empty session.
 *
 * Hat starts with a velocity ramp (mode 1 = flat 100) to demonstrate the
 * layer; users can clear it or switch modes via the accent UI later.
 */
export function defaultTracks(): Track[] {
  return [
    {
      id: 'kick',
      name: 'Kick',
      color: '#c084fc', // accent purple — the rhythmic anchor
      steps: 16,
      hits: 4,
      rotation: 0,
      mute: false,
      solo: false,
      voiceId: 'kick',
      volume: 100,
    },
    {
      id: 'snare',
      name: 'Snare',
      color: '#f472b6',
      steps: 16,
      hits: 2,
      rotation: 4, // backbeat: lands on 2 and 4
      mute: false,
      solo: false,
      voiceId: 'snare',
      volume: 100,
    },
    {
      id: 'hat',
      name: 'Hat',
      color: '#60a5fa',
      steps: 16,
      hits: 8,
      rotation: 0, // even eighth-notes
      mute: false,
      solo: false,
      voiceId: 'hat',
      volume: 100,
      velocityPattern: [100], // flat velocity; ready for accent ramp
    },
    {
      id: 'bass',
      name: 'Bass',
      color: '#34d399',
      steps: 16,
      hits: 3,
      rotation: 0, // tresillo-shaped bass
      mute: false,
      solo: false,
      voiceId: 'bass',
      volume: 100,
    },
  ];
}