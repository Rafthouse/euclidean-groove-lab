import type { Pattern } from './types';

/** An onset placed in continuous time within one cycle. */
export interface OnsetTime {
  /** The grid index the onset originally occupied (0-based). */
  step: number;
  /** Position within the cycle in fractional step units, in [0, steps). */
  time: number;
}

/**
 * Apply a continuous phase offset (in step units, may be fractional) to a
 * pattern, returning each onset as a time within the cycle.
 *
 * Unlike `rotate` -- an integer reshuffle that changes which steps are onsets
 * relative to a fixed meter -- `phase` slides the WHOLE groove along the time
 * axis without changing its internal interval structure. This is the basis for
 * inter-track phasing (Reich-style) and sub-step microtiming.
 *
 * With an integer offset, phase and rotate agree on the resulting onset times;
 * the difference only shows for fractional offsets.
 */
export function phase(pattern: Pattern, offsetSteps: number): OnsetTime[] {
  if (!Number.isFinite(offsetSteps)) {
    throw new RangeError(`phase: offsetSteps must be finite, got ${offsetSteps}`);
  }
  const n = pattern.length;
  const onsets: OnsetTime[] = [];
  for (let i = 0; i < n; i++) {
    if (pattern[i]) {
      const time = (((i + offsetSteps) % n) + n) % n;
      onsets.push({ step: i, time });
    }
  }
  return onsets.sort((a, b) => a.time - b.time);
}
