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

/**
 * Inter-onset intervals (gaps) around the cycle, in steps. For m onsets this
 * returns m intervals that sum to the pattern length. Returns [] when there are
 * no onsets and [length] for a single onset.
 */
export function interOnsetIntervals(pattern: Pattern): number[] {
  const n = pattern.length;
  const positions: number[] = [];
  for (let i = 0; i < n; i++) if (pattern[i]) positions.push(i);

  const m = positions.length;
  if (m === 0) return [];
  if (m === 1) return [n];

  const gaps: number[] = [];
  for (let i = 0; i < m; i++) {
    const next = positions[(i + 1) % m];
    gaps.push(((next - positions[i] + n) % n));
  }
  return gaps;
}

/**
 * True when the onsets are spread as evenly as the grid allows -- every pair of
 * adjacent onsets is separated by one of at most two interval sizes that differ
 * by exactly 1 (the defining property of a maximally even / Euclidean rhythm).
 * Patterns with 0 or 1 onsets are trivially maximally even.
 */
export function isMaximallyEven(pattern: Pattern): boolean {
  const gaps = interOnsetIntervals(pattern);
  if (gaps.length <= 1) return true;
  let min = Infinity;
  let max = -Infinity;
  for (const g of gaps) {
    if (g < min) min = g;
    if (g > max) max = g;
  }
  return max - min <= 1;
}

/**
 * Toussaint's rhythmic "balance" in [0, 1]. Each onset is a unit vector on the
 * circle; balance = 1 - |average of those vectors|. 1 means the onsets' centre
 * of mass sits exactly at the centre (perfectly balanced); 0 means all onsets
 * are clustered at a single point. No onsets -> 0.
 */
export function balance(pattern: Pattern): number {
  const n = pattern.length;
  let sx = 0;
  let sy = 0;
  let m = 0;
  for (let i = 0; i < n; i++) {
    if (pattern[i]) {
      const angle = (2 * Math.PI * i) / n;
      sx += Math.cos(angle);
      sy += Math.sin(angle);
      m++;
    }
  }
  if (m === 0) return 0;
  return 1 - Math.hypot(sx, sy) / m;
}

/**
 * Longuet-Higgins & Lee metric weights for a hierarchical (power-of-two) meter
 * of length `steps`. The downbeat gets weight 0; each finer level of binary
 * subdivision is one less (-1, -2, ...), so stronger metrical positions carry
 * higher (less negative) weights.
 *
 * Throws when `steps` is not a power of two -- non-binary meters need an
 * explicit subdivision tree, which higher layers can supply via the `weights`
 * argument to `syncopation`.
 */
export function metricWeights(steps: number): number[] {
  if (!Number.isInteger(steps) || steps <= 0 || (steps & (steps - 1)) !== 0) {
    throw new RangeError(`metricWeights: steps must be a power of two, got ${steps}`);
  }
  const weights = new Array<number>(steps).fill(0);
  for (let i = 0; i < steps; i++) {
    // Depth = the smallest d such that i lands on the level-d binary grid
    // (multiples of steps / 2^d). The downbeat (i = 0) is on every grid -> 0.
    let d = 0;
    while ((steps >> d) > 0 && i % (steps >> d) !== 0) d++;
    weights[i] = d === 0 ? 0 : -d; // avoid -0 for the downbeat
  }
  return weights;
}

/**
 * LHL-style syncopation score (Longuet-Higgins & Lee, 1984).
 *
 * A syncopation occurs when a note is held across a metrically STRONGER
 * position than the one it is articulated on. For each onset we scan the rests
 * it sounds through until the next onset; if the strongest of those rest
 * positions outranks the onset's own position, the difference in metric weight
 * is added to the score. Higher = more syncopated. A pattern whose onsets all
 * fall on positions at least as strong as the rests they precede scores 0.
 *
 * Pass custom `weights` for non-binary meters; defaults to LHL weights for a
 * power-of-two grid.
 */
export function syncopation(pattern: Pattern, weights?: number[]): number {
  const n = pattern.length;
  const w = weights ?? metricWeights(n);
  if (w.length !== n) {
    throw new RangeError(
      `syncopation: weights length ${w.length} != pattern length ${n}`
    );
  }

  const positions: number[] = [];
  for (let i = 0; i < n; i++) if (pattern[i]) positions.push(i);

  const m = positions.length;
  if (m < 2) return 0; // need at least two onsets to have a held rest between them

  let score = 0;
  for (let i = 0; i < m; i++) {
    const cur = positions[i];
    const next = positions[(i + 1) % m];

    // strongest metric weight among the rest positions strictly between cur and
    // next (cyclically)
    let strongestRest = -Infinity;
    for (let step = (cur + 1) % n; step !== next; step = (step + 1) % n) {
      if (w[step] > strongestRest) strongestRest = w[step];
    }

    if (strongestRest !== -Infinity && strongestRest > w[cur]) {
      score += strongestRest - w[cur];
    }
  }
  return score;
}
