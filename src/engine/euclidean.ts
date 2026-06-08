import type { Pattern } from './types';

/**
 * Generate the Euclidean rhythm E(hits, steps) using Bjorklund's algorithm.
 *
 * Bjorklund distributes `hits` onsets as evenly as possible across `steps`
 * positions via the same recursive subtraction process as Euclid's GCD
 * algorithm -- which is why Toussaint calls these "Euclidean rhythms". This is
 * the canonical reference implementation used across music software and matches
 * the patterns tabulated in G. Toussaint, "The Geometry of Musical Rhythm".
 *
 * The result is rotated so it starts on an onset (the conventional form); use
 * `rotate` to reach any other rotation of the same necklace.
 *
 * Edge cases: hits <= 0 -> all silent; hits >= steps -> all onsets.
 *
 * Replaces the earlier `while (remainder >= 0)` generator, which divided by
 * zero at remainder = 0 and mutated `steps` mid-loop, producing NaN indices
 * and incorrect spacings.
 */
export function euclid(hits: number, steps: number): Pattern {
  assertPositiveInt('steps', steps);
  assertNonNegativeInt('hits', hits);

  if (hits === 0) return new Array<boolean>(steps).fill(false);
  if (hits >= steps) return new Array<boolean>(steps).fill(true);

  // Bjorklund: repeatedly distribute the "remainder" groups onto the leading
  // groups, mirroring the Euclidean algorithm applied to (hits, steps - hits).
  const counts: number[] = [];
  const remainders: number[] = [hits];
  let divisor = steps - hits;
  let level = 0;

  for (;;) {
    counts.push(Math.floor(divisor / remainders[level]));
    remainders.push(divisor % remainders[level]);
    divisor = remainders[level];
    level += 1;
    if (remainders[level] <= 1) break;
  }
  counts.push(divisor);

  const pattern: boolean[] = [];
  const build = (lvl: number): void => {
    if (lvl === -1) {
      pattern.push(false);
    } else if (lvl === -2) {
      pattern.push(true);
    } else {
      for (let i = 0; i < counts[lvl]; i++) build(lvl - 1);
      if (remainders[lvl] !== 0) build(lvl - 2);
    }
  };
  build(level);

  // Bjorklund's recursion can emit the cycle starting on a rest; rotate so
  // index 0 is the first onset (canonical Euclidean form).
  const first = pattern.indexOf(true);
  return pattern.slice(first).concat(pattern.slice(0, first));
}

function assertPositiveInt(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`euclid: ${name} must be a positive integer, got ${value}`);
  }
}

function assertNonNegativeInt(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`euclid: ${name} must be a non-negative integer, got ${value}`);
  }
}
