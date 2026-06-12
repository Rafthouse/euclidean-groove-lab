import type { Pattern } from './types';

/** Number of onsets in the pattern. */
export function onsetCount(pattern: Pattern): number {
  let count = 0;
  for (const step of pattern) if (step) count++;
  return count;
}

/** Onset density in [0, 1]: onsets divided by steps. */
export function density(pattern: Pattern): number {
  return pattern.length === 0 ? 0 : onsetCount(pattern) / pattern.length;
}


