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
export type { Track, TrackPattern, VoiceId, VelocityPattern } from './track';

export {
  trackPattern,
  audibleTracks,
  defaultTracks,
  computeVelocities,
  VELOCITY_PRESETS,
} from './track';

export { pulse } from './pulse';
export { euclid } from './euclidean';
export { rotate } from './rotate';
export { phase } from './phase';
export {
  onsetCount,
  density,
  interOnsetIntervals,
  isMaximallyEven,
  balance,
  metricWeights,
  syncopation,
} from './metrics';
