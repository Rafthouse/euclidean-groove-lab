import type { Pattern } from './types';
import { euclid } from './euclidean';
import { rotate } from './rotate';

/**
 * One of four fixed voice slots. The slot identity is locked from Commit 1
 * even though all four currently map to the same kick synth -- this keeps
 * Commit 2 (real voices) a swap, not a re-plumb of the audio graph.
 */
export type VoiceId = 'kick' | 'snare' | 'hat' | 'bass';

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
}

/**
 * The per-track carrier that grows over time. Today it holds only `pulses`;
 * accents / velocities / microtiming attach to the same object in later
 * commits without changing the surrounding API.
 */
export interface TrackPattern {
  pulses: Pattern;
  accents?: number[];
  velocities?: number[];
  microtiming?: number[];
}

/**
 * Derive a track's playable pattern. This is the ONLY place where rhythm
 * gets composed for a track -- UI and audio always consume the result, never
 * compute their own.
 */
export function trackPattern(track: Track): TrackPattern {
  return { pulses: rotate(euclid(track.hits, track.steps), track.rotation) };
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
 * Seed state for Commit 1: a four-track kit with the four voice slots wired
 * up but all silent except Kick. Defaults chosen so that hitting Play yields
 * something musical immediately, not a clinical metronome.
 *
 * These are *defaults*, not a preset. A `Preset` is a named multi-track
 * snapshot (Commit 3). Defaults are the bootstrap state of an empty session.
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
    },
  ];
}
