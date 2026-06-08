import type { Pattern } from './types';

/**
 * The bare isochronous pulse: a grid of `steps` silent positions.
 *
 * This is the substrate of the groove-evolution pipeline -- the empty canvas
 * onto which `euclid` distributes onsets. Keeping it as its own stage lets the
 * "Groove Evolution" view render the grid first (Pulse), then the distribution
 * (Euclidean), and so on.
 */
export function pulse(steps: number): Pattern {
  if (!Number.isInteger(steps) || steps <= 0) {
    throw new RangeError(`pulse: steps must be a positive integer, got ${steps}`);
  }
  return new Array<boolean>(steps).fill(false);
}
