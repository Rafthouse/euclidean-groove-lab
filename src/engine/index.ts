/**
 * Rhythm engine -- the pure, framework-free core of the lab.
 *
 * The groove pipeline is built from small, independently testable transforms:
 *   pulse -> euclid -> rotate -> (accent) -> phase -> (microtiming) -> groove
 * The bracketed stages arrive in later commits; this module covers the
 * foundation: distribution, rotation, phase and analysis metrics.
 */
export type { Pattern } from './types';
export type { OnsetTime } from './phase';
export type { Track, TrackPattern, VoiceId, VelocityPattern, GhostModule, DuckingModule, PatternSlot } from './track';
export type { PlaybackMode, PlaybackSpeed } from './playback';
export {
  divider,
  isActive,
  adjustedTick,
  localStep,
  computePhaseOffsetForChange,
} from './playback';
export type {
  MidiNote,
  PitchSpec,
  PitchEvent,
  PitchSlot,
  PitchSequence,
  ScaleType,
  ChordSymbol,
  HarmonicContext,
  ResolvedOnset,
} from './pitch';

export {
  trackPattern,
  audibleTracks,
  defaultTracks,
  computeVelocities,
  isStepMuted,
  switchTrackPattern,
  PATTERN_SLOT_COUNT,
} from './track';

export {
  resolvePitchSpec,
  onsetIndexAt,
  resolveOnset,
  parseNoteToken,
  parseNoteSequence,
  midiToNoteName,
  pitchSequenceToText,
  isPitchedVoice,
} from './pitch';

export type { MidiNoteEvent, MidiTrackData, MidiProject, MidiStem } from './midi';
export { renderMidi, serializeMidi, renderMidiStems, GM_DRUM_MAP } from './midi';

export { pulse } from './pulse';
export { euclid } from './euclidean';
export { rotate } from './rotate';
export { phase } from './phase';
export {
  onsetCount,
  density,
} from './metrics';
