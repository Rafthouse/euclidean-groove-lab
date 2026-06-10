/**
 * Pure state and drag logic for the Velocity Lane, kept out of the React
 * component so the painting math (cross-bar drag) is testable in node without
 * the DOM. Mirrors the structure of `pitchLaneState.ts`.
 *
 * The velocity pattern itself lives on `Track.velocityPattern` (already in the
 * engine). The lane is a UI editor — the cycle's length is independent of the
 * onset count: a velocity sequence of length 3 against 8 onsets drifts through
 * accents, which is the whole point.
 */

/** Default seed velocity when opening the lane: a single flat point. */
export const VELOCITY_STARTER: number[] = [100];

export interface VelocityLaneState {
  /** UI: is the lane expanded? Controlled ONLY by the toggle, never by data. */
  open: boolean;
}

export type VelocityLaneAction = { type: 'toggle' };

export function initVelocityLaneState(hasPattern: boolean): VelocityLaneState {
  return { open: hasPattern };
}

export function velocityLaneReducer(
  state: VelocityLaneState,
  action: VelocityLaneAction,
): VelocityLaneState {
  switch (action.type) {
    case 'toggle':
      return { open: !state.open };
    default:
      return state;
  }
}

/**
 * Paint a velocity value across a span of bars.
 *
 * Cross-bar drag: when the pointer moves quickly from bar A to bar B, every
 * intermediate bar gets the new value too (no skips). This is what makes
 * "drawing a curve in one stroke" feel right — slow drags update one bar at
 * a time, fast drags fill the trail.
 *
 * Pure function: takes a pattern + drag state, returns the new pattern.
 */
export function paintBar(
  pattern: readonly number[],
  fromIdx: number | null,
  toIdx: number,
  velocityPercent: number,
): number[] {
  const N = pattern.length;
  if (N === 0) return [];
  const v = Math.max(0, Math.min(100, Math.round(velocityPercent)));
  const result = pattern.slice();
  if (fromIdx === null) {
    if (toIdx >= 0 && toIdx < N) result[toIdx] = v;
    return result;
  }
  const from = Math.max(0, Math.min(N - 1, Math.min(fromIdx, toIdx)));
  const to = Math.max(0, Math.min(N - 1, Math.max(fromIdx, toIdx)));
  for (let i = from; i <= to; i++) result[i] = v;
  return result;
}

/**
 * Map a pointer position inside the bar container to (bar index, velocity %).
 * Pure function: takes geometry numbers, returns indexes — no DOM access here,
 * so the math is unit-testable.
 */
export function pointerToBarValue(
  x: number,
  y: number,
  width: number,
  height: number,
  barCount: number,
): { idx: number; velocity: number } {
  const idxRaw = Math.floor((x / width) * barCount);
  const idx = Math.max(0, Math.min(barCount - 1, idxRaw));
  const velocityRaw = Math.round((1 - y / height) * 100);
  const velocity = Math.max(0, Math.min(100, velocityRaw));
  return { idx, velocity };
}
