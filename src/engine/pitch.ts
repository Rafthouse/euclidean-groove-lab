/**
 * Pitch layer — a second independent cycle that crosses the rhythm pipeline's
 * output. It is NOT a pipeline stage: pitch is onset-indexed (onset N reads
 * slot `N % slots.length`), so its length is independent of the rhythm. When the
 * two lengths differ the cycles drift — isorhythm (rhythm = talea, pitch = color).
 *
 * Pure module: no Tone.js, no React. Audio and UI are downstream consumers.
 * The full, locked model lives in docs/PITCH-DATA-MODEL-RECONCILIATION.md.
 */
import type { Track, TrackPattern, VoiceId } from './track';

/** MIDI note number, 0–127. C4 = 60, E2 = 40. Canonical for storage + export. */
export type MidiNote = number;

/**
 * How ONE note is named.
 *  - 'absolute' : a concrete MIDI note (the only path used in Variant B).
 *  - 'degree'   : a scale degree resolved against a HarmonicContext. Declared now,
 *                 exercised only once the Harmonic Layer (Variant C) creates them.
 */
export type PitchSpec =
  | { kind: 'absolute'; midi: MidiNote }
  | { kind: 'degree'; degree: number; octaveOffset?: number };

/**
 * One sounded pitch at one onset.
 * Velocity precedence (per onset, applied in resolveOnset):
 *   PitchEvent.velocity > TrackPattern.velocities[step] > default (100).
 */
export interface PitchEvent {
  pitch: PitchSpec;
  velocity?: number; // 0–100, onset dynamics
  durationSteps?: number; // note length in 16th-steps; default 1
}

/** One slot of a pitch cycle. `null` = sounded onset with no pitch (ghost / rest). */
export type PitchSlot = PitchEvent | null;

/**
 * A cyclic sequence of pitches, onset-indexed and INDEPENDENT in length from the
 * rhythm. Absent on a Track => drum-style (no pitch layer).
 */
export interface PitchSequence {
  id: string;
  name?: string;
  slots: PitchSlot[];
}

/**
 * Voices that carry pitch. The pitch layer is offered ONLY for these — drum
 * voices stay purely rhythmic, so a pitch sequence's rests never become an
 * accidental gate on a drum (one layer, one responsibility). Today only the
 * bass is pitched; melodic voices added later join this set.
 */
export const PITCHED_VOICES: ReadonlySet<VoiceId> = new Set<VoiceId>(['bass']);

export function isPitchedVoice(voiceId: VoiceId): boolean {
  return PITCHED_VOICES.has(voiceId);
}

// ── Harmony (declared now, inert until the Harmonic Layer / Variant C) ─────────

export type ScaleType =
  | 'major'
  | 'minor'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'locrian'
  | 'harmonic-minor'
  | 'melodic-minor'
  | 'pentatonic-major'
  | 'pentatonic-minor'
  | 'chromatic';

export interface ChordSymbol {
  degree: number; // scale degree the chord is rooted on (1-based)
  quality: 'maj' | 'min' | 'dom7' | 'maj7' | 'min7' | 'dim' | 'aug';
}

/** Global harmonic context a `degree` PitchSpec resolves against. */
export interface HarmonicContext {
  root: MidiNote; // tonic, e.g. 48 = C3
  scale: ScaleType;
  chord?: ChordSymbol;
}

const DEFAULT_VELOCITY = 100;

/** Used when a `degree` spec must resolve but no context is supplied (inert path). */
const DEFAULT_CONTEXT: HarmonicContext = { root: 48, scale: 'major' };

const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
  'melodic-minor': [0, 2, 3, 5, 7, 9, 11],
  'pentatonic-major': [0, 2, 4, 7, 9],
  'pentatonic-minor': [0, 3, 5, 7, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

/**
 * Resolve a PitchSpec to a concrete MIDI note.
 * `absolute` returns its note directly. `degree` resolves against `ctx`
 * (root + scale); degrees beyond the scale length wrap and raise an octave,
 * with `octaveOffset` adding octaves on top.
 */
export function resolvePitchSpec(spec: PitchSpec, ctx?: HarmonicContext): MidiNote {
  if (spec.kind === 'absolute') return spec.midi;

  const c = ctx ?? DEFAULT_CONTEXT;
  const intervals = SCALE_INTERVALS[c.scale];
  const n = intervals.length;
  const zeroBased = spec.degree - 1;
  const octave = Math.floor(zeroBased / n) + (spec.octaveOffset ?? 0);
  const idx = ((zeroBased % n) + n) % n;
  return c.root + octave * 12 + intervals[idx];
}

/**
 * Global onset index for a pulse pattern at a given global step (pure, no state).
 * Counts how many onsets fire in [0, globalStep). O(pattern length), not O(step):
 * full cycles are multiplied, only the remainder is walked.
 */
export function onsetIndexAt(pulses: boolean[], globalStep: number): number {
  const steps = pulses.length;
  if (steps <= 0 || globalStep <= 0) return 0;
  const onsetsPerCycle = pulses.reduce((sum, on) => sum + (on ? 1 : 0), 0);
  const fullCycles = Math.floor(globalStep / steps);
  const remainder = globalStep % steps;
  let count = fullCycles * onsetsPerCycle;
  for (let i = 0; i < remainder; i++) if (pulses[i]) count++;
  return count;
}

/** What sounds at this step. */
export interface ResolvedOnset {
  step: number;
  midi?: MidiNote; // undefined => drum onset (voice plays its intrinsic sound)
  velocity: number; // 0–100, resolved per the precedence rule
  durationSteps: number;
}

/**
 * Resolve what (if anything) sounds at `globalStep` for a track.
 *
 * Returns `null` when nothing should sound — either there is no rhythmic onset
 * here, or the track has a pitch layer whose slot at this onset is a rest.
 *
 * Returns a `ResolvedOnset` when something sounds:
 *  - drum-style track (no pitch layer): `midi` is undefined; the voice plays its
 *    intrinsic sample. Velocity = step accent (TrackPattern.velocities) or default.
 *  - pitched note: `midi` is the resolved note; velocity follows the precedence
 *    PitchEvent.velocity > TrackPattern.velocities[step] > default.
 */
export function resolveOnset(
  track: Track,
  tp: TrackPattern,
  globalStep: number,
  ctx?: HarmonicContext,
): ResolvedOnset | null {
  const steps = tp.pulses.length;
  if (steps <= 0) return null;
  const localStep = ((globalStep % steps) + steps) % steps;
  if (!tp.pulses[localStep]) return null; // no rhythmic onset here

  const stepVel = tp.velocities ? tp.velocities[localStep] : undefined;

  // Drum-style: no pitch layer (or an empty one) — voice fires its own sound.
  if (!track.pitches || track.pitches.slots.length === 0) {
    return {
      step: globalStep,
      midi: undefined,
      velocity: stepVel ?? DEFAULT_VELOCITY,
      durationSteps: 1,
    };
  }

  const onsetIdx = onsetIndexAt(tp.pulses, globalStep);
  const slot = track.pitches.slots[onsetIdx % track.pitches.slots.length];
  if (slot === null) return null; // rest: a sounded onset that stays silent

  return {
    step: globalStep,
    midi: resolvePitchSpec(slot.pitch, ctx),
    velocity: slot.velocity ?? stepVel ?? DEFAULT_VELOCITY,
    durationSteps: slot.durationSteps ?? 1,
  };
}

// ── Note-name <-> MIDI helpers (display / text input; storage stays MidiNote) ──

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const SEMITONE_TO_NOTE = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

/**
 * Parse a single token to a MidiNote, or null if invalid.
 * Accepts a raw MIDI number ("60") or a note name ("C3", "Bb3", "F#2", "Eb-1").
 * Convention: C4 = 60 (so midi = (octave + 1) * 12 + semitone).
 */
export function parseNoteToken(token: string): MidiNote | null {
  const t = token.trim();
  if (t === '') return null;

  if (/^\d+$/.test(t)) {
    const n = Number(t);
    return n >= 0 && n <= 127 ? n : null;
  }

  const m = /^([A-Ga-g])([#b]*)(-?\d+)$/.exec(t);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  let semitone = NOTE_TO_SEMITONE[letter];
  for (const ch of m[2]) semitone += ch === '#' ? 1 : -1;
  const octave = parseInt(m[3], 10);
  const midi = (octave + 1) * 12 + semitone;
  return midi >= 0 && midi <= 127 ? midi : null;
}

/** Format a MidiNote as a note name, e.g. 40 -> "E2", 60 -> "C4". */
export function midiToNoteName(midi: MidiNote): string {
  const octave = Math.floor(midi / 12) - 1;
  const name = SEMITONE_TO_NOTE[((midi % 12) + 12) % 12];
  return `${name}${octave}`;
}

/**
 * Parse a whitespace/comma-separated line into pitch slots.
 * A rest is written as `-`, `.` or `_` and becomes `null`. Tokens that fail to
 * parse are collected in `errors` (and skipped), so partial input never throws.
 */
export function parseNoteSequence(input: string): {
  slots: PitchSlot[];
  errors: string[];
} {
  const tokens = input.split(/[\s,]+/).filter((s) => s.length > 0);
  const slots: PitchSlot[] = [];
  const errors: string[] = [];
  for (const tok of tokens) {
    if (tok === '-' || tok === '.' || tok === '_') {
      slots.push(null);
      continue;
    }
    const midi = parseNoteToken(tok);
    if (midi === null) {
      errors.push(tok);
      continue;
    }
    slots.push({ pitch: { kind: 'absolute', midi } });
  }
  return { slots, errors };
}

/**
 * Render a PitchSequence back to an editable text line. Rests become `-`.
 * `degree` specs (inert in Variant B) resolve via the default context for display.
 */
export function pitchSequenceToText(seq: PitchSequence): string {
  return seq.slots
    .map((s) => (s === null ? '-' : midiToNoteName(resolvePitchSpec(s.pitch))))
    .join(' ');
}
