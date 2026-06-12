import type { Pattern } from './types';
import type { PitchSequence } from './pitch';
import type { PlaybackMode, PlaybackSpeed } from './playback';
import { computePhaseOffsetForChange } from './playback';
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

  /**
   * Manual mute overlay, indexed by STEP (length === steps when present). `true`
   * suppresses the generated onset at that step. A post-processing layer ON TOP
   * of the Euclidean pattern — it never changes generation, rotation, density,
   * or onset indexing; it only suppresses output (audio + MIDI). `undefined` =
   * no overrides.
   */
  manualMute?: boolean[];

  /**
   * Main-note velocity module (MAIN ONLY — never read by the ghost path).
   *  - `velocity` holds the cyclic per-onset velocity sequence for the main hit.
   *  - `velocityEnabled` gates the module ON/OFF (default OFF). When OFF the
   *    engine ignores the pattern entirely (flat velocity). The pattern data is
   *    NEVER cleared by toggling — disabling preserves it for the next enable.
   * Universal field on Track; UI exposes the editor only for the hat voice.
   */
  velocityEnabled?: boolean;
  velocity?: VelocityPattern;

  /**
   * Pitch module.
   *  - `pitches` holds the onset-indexed cycle (isorhythm).
   *  - `pitchEnabled` gates the module ON/OFF (default OFF). When OFF the audio
   *    scheduler treats the track as drum-style (no pitch). Data preserved on
   *    toggle. Universal; UI exposes the editor only for the bass voice.
   * See docs/PITCH-DATA-MODEL-RECONCILIATION.md.
   */
  pitchEnabled?: boolean;
  pitches?: PitchSequence;

  /**
   * Ghost Delay module (Snare). Schedules a duplicate of the main hit `delaySteps`
   * 16th-notes later with `probability` chance, at `velocity` 0–100. Persistent
   * data is the params themselves; `enabled` gates the whole module.
   */
  ghost?: GhostModule;

  /**
   * Ducking module (Kick). When the kick fires, the target voice's volume is
   * attenuated for `decaySteps` 16ths by up to `amount` (0–1). Single shared
   * scheduler-side state; persistent data is the params here. Target defaults
   * to 'bass'.
   */
  ducking?: DuckingModule;

  /**
   * Per-track playback config. The audio scheduler runs a SINGLE clock; these
   * fields only change how that clock's `g` is INTERPRETED for this track.
   * Defaults: forward / 1× / no offset → identical to the pre-C3 behaviour.
   * `phaseOffset` preserves musical position across mode/speed/steps changes
   * (computed and written by the event handler; the resolver only reads it).
   */
  playbackMode?: PlaybackMode;
  playbackSpeed?: PlaybackSpeed;
  phaseOffset?: number;

  /**
   * Pattern bank — up to {@link PATTERN_SLOT_COUNT} stored generator snapshots
   * (slots A–P, two rows of 8). The LIVE generator fields (steps/hits/rotation/manualMute) are
   * always the working copy of `patterns[activePattern]`; switching slots saves
   * the live fields back into the current slot and loads the target slot, so
   * each slot's edits are preserved independently (see `switchTrackPattern`).
   * Sound-design modules (velocity/pitch/ghost) and playback config are NOT part
   * of a slot — they persist across pattern switches.
   */
  patterns?: PatternSlot[];
  activePattern?: number;
}

/**
 * One stored pattern in a track's bank. Captures Euclidean generator state
 * plus the voice-specific module state, so each slot carries its own rhythm
 * AND its own sound design. Voice fields are optional — only present when the
 * voice exposes the module in the UI.
 *
 * When switching slots: if a field is present in the target it overrides the
 * live track; if absent, the live track's field is left unchanged (backward
 * compatibility with pre-module slots).
 */
export interface PatternSlot {
  steps: number;
  hits: number;
  rotation: number;
  manualMute?: boolean[];
  // Module state — voice-specific; stored alongside the rhythm so different
  // pattern slots can carry different sounds, not just different rhythms.
  velocity?: VelocityPattern;     // Hat: per-onset velocity cycle
  velocityEnabled?: boolean;      // Hat: module gate
  pitches?: PitchSequence;        // Bass: isorhythm pitch sequence
  pitchEnabled?: boolean;         // Bass: module gate
  ghost?: GhostModule;            // Snare: ghost delay params + enabled flag
}

/** Number of pattern slots per track (A–L). */
export const PATTERN_SLOT_COUNT = 16;

/**
 * Ghost Delay module — duplicates the main hit on a probabilistic delayed
 * retrigger. Snare's signature module; lives on Track for future portability.
 *
 * CRITICAL: the ghost is a SEPARATE audio lane — its own Tone.Player and its
 * own HP→LP filter chain in audio.ts. It never shares the main snare voice,
 * so retriggering it can no longer cut the main sample's transient. The fields
 * below are all GHOST-ONLY; none is ever read by the main-note path.
 */
export interface GhostModule {
  enabled: boolean;
  amount: number;       // 0..100 — ghost level (own gain, never the main velocity)
  delaySteps: number;   // 1..4, expressed in 16th-note steps
  probability: number;  // 0..1
  hpHz: number;         // high-pass cutoff for the ghost lane
  lpHz: number;         // low-pass cutoff for the ghost lane
}

/**
 * Ducking module — attenuates `target` voice's volume after the source voice fires.
 * Used by Kick to make space for Bass. Single source of truth on the source Track;
 * the scheduler maintains a one-shot `lastTrigger` state to apply the decay.
 */
export interface DuckingModule {
  enabled: boolean;
  target: VoiceId;      // default 'bass'
  amount: number;       // 0..1 — fraction of volume to remove at peak
  decaySteps: number;   // 1..8 — how many 16ths until ducking fully recovers
}

/**
 * The per-track carrier that grows over time.
 *
 * MUTE CONTRACT (onset-indexed):
 *   `pulses`         — raw Euclidean output: every generated onset is true,
 *                      regardless of the manual mute overlay. Used for:
 *                      shape rendering, density metrics, velocity/pitch
 *                      onset-indexing.
 *   `effectivePulses`— pulses with muted onsets suppressed to false. Used by
 *                      the audio scheduler and MIDI export to decide whether
 *                      to emit a sound / note event.
 *   `mutedStepMask`  — step-indexed boolean: true wherever an onset is
 *                      currently muted. Used by the ring and mask row to
 *                      render the dimmed/crossed visual without re-deriving
 *                      the onset index in the UI.
 */
export interface TrackPattern {
  pulses: Pattern;
  effectivePulses: Pattern;
  mutedStepMask: boolean[];
  accents?: number[];
  velocities?: number[];
  microtiming?: number[];
}

/**
 * Derive the mute overlay from an onset-indexed mask. Returns:
 *  - `effectivePulses`: copy of `pulses` with muted onsets zeroed.
 *  - `mutedStepMask`:   step-indexed mirror of which onsets are muted.
 *
 * When there are no active mutes, `effectivePulses` IS `pulses` (same
 * reference — no allocation) and `mutedStepMask` is all-false.
 */
function computeMuteFields(
  pulses: boolean[],
  manualMute?: boolean[],
): { effectivePulses: boolean[]; mutedStepMask: boolean[] } {
  const mutedStepMask = new Array<boolean>(pulses.length).fill(false);
  if (!manualMute || !manualMute.some(Boolean)) {
    return { effectivePulses: pulses, mutedStepMask };
  }
  const effectivePulses = pulses.slice();
  let onsetIndex = 0;
  for (let i = 0; i < pulses.length; i++) {
    if (!pulses[i]) continue;
    if (manualMute[onsetIndex] === true) {
      mutedStepMask[i] = true;
      effectivePulses[i] = false;
    }
    onsetIndex++;
  }
  return { effectivePulses, mutedStepMask };
}

/**
 * Derive a track's playable pattern.
 *
 * Velocity is gated by the `velocityEnabled` module flag — the pattern data is
 * preserved across toggles, but only consumed when the module is ON. When OFF
 * `velocities` is undefined and the audio scheduler falls back to flat 1.0.
 *
 * The manual mute overlay (`manualMute`) is ONSET-indexed: index 0 is the first
 * generated onset, index 1 the second, etc. — regardless of rotation. Rotating
 * the pattern therefore never changes which musical event is muted.
 */
export function trackPattern(track: Track): TrackPattern {
  const pulses = rotate(euclid(track.hits, track.steps), track.rotation);
  const { effectivePulses, mutedStepMask } = computeMuteFields(pulses, track.manualMute);
  const velocityActive =
    track.velocityEnabled === true &&
    !!track.velocity &&
    track.velocity.length > 0;
  const velocities = velocityActive
    ? computeVelocities(pulses, track.velocity!)
    : undefined;
  return { pulses, effectivePulses, mutedStepMask, velocities };
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
 * Whether the generated onset at `globalStep` is manually muted.
 *
 * The manual mute overlay is ONSET-indexed: `manualMute[k]` suppresses the
 * k-th onset in the ROTATED Euclidean pattern. Rotating the pattern never
 * changes which musical event is muted — the same note stays silent regardless
 * of where it lands on the step grid.
 *
 * Callers with access to a pre-computed `TrackPattern` should prefer
 * `tp.mutedStepMask[localStep]` (no extra allocation). `isStepMuted` is kept
 * for callers that only have the `Track` (e.g. MIDI export iterating steps
 * without caching the pattern).
 */
export function isStepMuted(track: Track, globalStep: number): boolean {
  const mask = track.manualMute;
  if (!mask || mask.length === 0 || !mask.some(Boolean) || track.steps <= 0) return false;
  const pulses = rotate(euclid(track.hits, track.steps), track.rotation);
  const step = ((globalStep % track.steps) + track.steps) % track.steps;
  if (!pulses[step]) return false; // rest — cannot be muted
  let onsetIndex = 0;
  for (let i = 0; i < step; i++) {
    if (pulses[i]) onsetIndex++;
  }
  return mask[onsetIndex] === true;
}

/**
 * Snapshot a track's LIVE generator state into a {@link PatternSlot}. Only the
 * Euclidean inputs + mask are captured; an all-false mask collapses to
 * `undefined` so "no overrides" stays the clean default.
 */
export function snapshotPattern(track: Track): PatternSlot {
  const mask =
    track.manualMute && track.manualMute.some(Boolean)
      ? track.manualMute.slice()
      : undefined;
  const slot: PatternSlot = {
    steps: track.steps,
    hits: track.hits,
    rotation: track.rotation,
    manualMute: mask,
  };
  // Capture module state — only fields the track has (undefined = not present,
  // which means "don't override" when loading this slot back).
  if (track.velocity !== undefined) slot.velocity = track.velocity.slice();
  if (track.velocityEnabled !== undefined) slot.velocityEnabled = track.velocityEnabled;
  if (track.pitches !== undefined) {
    slot.pitches = { ...track.pitches, slots: track.pitches.slots.slice() };
  }
  if (track.pitchEnabled !== undefined) slot.pitchEnabled = track.pitchEnabled;
  if (track.ghost !== undefined) slot.ghost = { ...track.ghost };
  return slot;
}

/**
 * Switch a track to pattern slot `slot` (0-based), returning a NEW track.
 *
 * Contract:
 *  - The live generator fields are first snapshotted back into the current slot
 *    (`activePattern`), so the slot you leave keeps its latest edits.
 *  - The target slot is then loaded into the live fields. An EMPTY target slot
 *    is materialised as a copy of the snapshot (duplicate-and-diverge), so
 *    switching never lands on a silent/blank pattern.
 *  - Generator fields are clamped exactly as `updateTrack` would (hits ≤ steps,
 *    rotation wrapped, mask length-matched).
 *  - Musical position is preserved across the (possible) steps change via
 *    `computePhaseOffsetForChange`, honouring the single-clock invariant — no
 *    new timing source is introduced; only `phaseOffset` is recomputed.
 *  - Modules (velocity/pitch/ghost/ducking), volume, mute/solo and playback
 *    mode/speed are untouched: a slot is a RHYTHM, not a full channel preset.
 *
 * `globalStep` is the current clock value (`-1` when stopped) used only for
 * phase preservation; pass `-1` to skip it.
 */
export function switchTrackPattern(
  track: Track,
  slot: number,
  globalStep: number,
): Track {
  if (!Number.isInteger(slot) || slot < 0 || slot >= PATTERN_SLOT_COUNT) {
    return track;
  }
  const current = track.activePattern ?? 0;
  const slots: PatternSlot[] = track.patterns ? track.patterns.slice() : [];
  const snapshot = snapshotPattern(track);
  slots[current] = snapshot;

  if (slot === current) {
    // No movement — just persist the snapshot so the bank reflects live edits.
    return { ...track, patterns: slots, activePattern: current };
  }

  const target = slots[slot] ?? snapshot; // empty slot = duplicate current
  slots[slot] = target; // materialise the loaded slot

  const steps = target.steps;
  const hits = Math.min(target.hits, steps);
  const rotation =
    steps > 0 ? ((target.rotation % steps) + steps) % steps : 0;
  // manualMute is ONSET-indexed (length === hits). Resize defensively if the
  // stored slot's mute array length doesn't match the (clamped) hit count.
  let mask: boolean[] | undefined;
  if (target.manualMute && target.manualMute.some(Boolean)) {
    if (target.manualMute.length === hits) {
      mask = target.manualMute.slice();
    } else {
      const resized = new Array<boolean>(hits).fill(false);
      const n = Math.min(hits, target.manualMute.length);
      for (let i = 0; i < n; i++) resized[i] = target.manualMute[i];
      if (resized.some(Boolean)) mask = resized;
    }
  }

  const mode: PlaybackMode = track.playbackMode ?? 'forward';
  const speed: PlaybackSpeed = track.playbackSpeed ?? 1;
  let phaseOffset = track.phaseOffset ?? 0;
  if (globalStep >= 0 && track.steps > 0 && steps > 0 && track.steps !== steps) {
    phaseOffset = computePhaseOffsetForChange(
      globalStep,
      mode, speed, track.phaseOffset ?? 0, track.steps,
      mode, speed, steps,
    );
  }

  return {
    ...track,
    steps,
    hits,
    rotation,
    manualMute: mask,
    patterns: slots,
    activePattern: slot,
    phaseOffset,
    // Restore module state only when the target slot stored it. If absent the
    // spread-from-track above already provides the current live value.
    ...(target.velocity !== undefined && { velocity: target.velocity.slice() }),
    ...(target.velocityEnabled !== undefined && { velocityEnabled: target.velocityEnabled }),
    ...(target.pitches !== undefined && {
      pitches: { ...target.pitches, slots: target.pitches.slots.slice() },
    }),
    ...(target.pitchEnabled !== undefined && { pitchEnabled: target.pitchEnabled }),
    ...(target.ghost !== undefined && { ghost: { ...target.ghost } }),
  };
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
 * All optional modules (velocity, pitch, ghost, ducking) ship DISABLED so
 * playback starts as pure rhythm and the user opts into each module
 * deliberately via its UI toggle.
 */
/**
 * Military tactical preset — staccato, percussive, grid-like.
 * Each voice tuned for a march / strut feel.
 */
export function militaryPreset(): Track[] {
  return [
    {
      id: 'kick',
      name: 'Kick',
      color: '#6d8a6d',
      steps: 16,
      hits: 5,
      rotation: 0,
      mute: false,
      solo: false,
      voiceId: 'kick',
      volume: 100,
      velocityEnabled: true,
      velocity: [100, 90, 100, 85, 95],
      playbackMode: 'forward',
      playbackSpeed: 1,
    },
    {
      id: 'snare',
      name: 'Snare',
      color: '#b0a070',
      steps: 16,
      hits: 4,
      rotation: 4,
      mute: false,
      solo: false,
      voiceId: 'snare',
      volume: 100,
      velocityEnabled: true,
      velocity: [100, 85, 90, 80],
      playbackMode: 'forward',
      playbackSpeed: 1,
    },
    {
      id: 'hat',
      name: 'Hat',
      color: '#7090b0',
      steps: 16,
      hits: 11,
      rotation: 0,
      mute: false,
      solo: false,
      voiceId: 'hat',
      volume: 80,
      velocityEnabled: true,
      velocity: [70, 80, 65, 85, 75, 90, 60, 88, 72, 82, 68],
      playbackMode: 'forward',
      playbackSpeed: 1,
    },
    {
      id: 'bass',
      name: 'Bass',
      color: '#3d6b3d',
      steps: 16,
      hits: 4,
      rotation: 2,
      mute: false,
      solo: false,
      voiceId: 'bass',
      volume: 100,
      velocityEnabled: true,
      velocity: [100, 80, 90, 75],
      playbackMode: 'forward',
      playbackSpeed: 1,
    },
  ];
}

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
      playbackMode: 'forward',
      playbackSpeed: 1,
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
      playbackMode: 'forward',
      playbackSpeed: 1,
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
      playbackMode: 'forward',
      playbackSpeed: 1,
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
      playbackMode: 'forward',
      playbackSpeed: 1,
    },
  ];
}