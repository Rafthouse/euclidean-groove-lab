/**
 * Per-track playback resolver — pure, single-clock.
 *
 * Critical contract: ONE global clock (Tone.Transport), ONE monotonic global
 * step counter `g`. Every track is just a DIFFERENT INTERPRETATION of `g`.
 * No per-track timers, no accumulating counters, no float drift — by
 * construction, polyrhythm cannot desynchronise.
 *
 *   isActive(g, speed)  ∧  localStep(g, mode, speed, offset, N) → playback
 *
 * Mode change / speed change preserves musical position via `phaseOffset`,
 * which is a CONFIG value (read by the resolver, written only by the event
 * handler on user change). The resolver itself never writes.
 *
 * 32n master subdivision is the smallest grid we need: 2× speed on a 16th-note
 * pattern fires twice per 16th, which is once per 32nd.
 */

export type PlaybackMode = 'forward' | 'reverse' | 'pendulum';
export type PlaybackSpeed = 0.5 | 1 | 2;

/** How many 32n master ticks between two successive step advances. */
export function divider(speed: PlaybackSpeed): number {
  switch (speed) {
    case 2:
      return 1;
    case 1:
      return 2;
    case 0.5:
      return 4;
  }
}

/** True when this global tick lands on a step-event for the given speed. */
export function isActive(g: number, speed: PlaybackSpeed): boolean {
  return g % divider(speed) === 0;
}

/**
 * Integer "local tick" the track has reached at global tick `g`. This is
 * monotonic in `g` regardless of playback mode — modes only PERMUTE the
 * mapping from local tick to local step, never reverse the tick itself.
 *
 * `phaseOffset` is added as an integer so a mode/speed change can preserve
 * the current localStep without restarting the clock.
 */
export function adjustedTick(
  g: number,
  speed: PlaybackSpeed,
  phaseOffset: number,
): number {
  return Math.floor(g / divider(speed)) + phaseOffset;
}

const mod = (a: number, n: number): number => ((a % n) + n) % n;

/**
 * Map a track's local tick onto a step index in [0, N) according to the mode.
 * Pendulum endpoints fire once (Reich convention): for N=4 → 0,1,2,3,2,1,0,1...
 *
 * Edge cases:
 *  - N <= 0 → caller should skip the track entirely; we return -1 as a sentinel.
 *  - N === 1 → always step 0 (pendulum degenerate).
 */
export function localStep(
  g: number,
  mode: PlaybackMode,
  speed: PlaybackSpeed,
  phaseOffset: number,
  N: number,
): number {
  if (N <= 0) return -1;
  if (N === 1) return 0;
  const t = adjustedTick(g, speed, phaseOffset);
  switch (mode) {
    case 'forward':
      return mod(t, N);
    case 'reverse':
      return N - 1 - mod(t, N);
    case 'pendulum': {
      const period = 2 * (N - 1);
      const p = mod(t, period);
      return p < N ? p : period - p;
    }
  }
}

/**
 * Inverse of `localStep` for `forward` and `reverse`: given a target step `S`
 * and a basic tick (g / divider) without offset, return the phaseOffset such
 * that adjustedTick(g, speed, offset) lands on a tick that resolves to S.
 *
 * For pendulum, returns the offset for the forward-going branch of the
 * pendulum at step S (the simplest single-valued choice).
 */
export function offsetForStep(
  mode: PlaybackMode,
  N: number,
  targetStep: number,
  basicTick: number,
): number {
  if (N <= 1) return 0;
  switch (mode) {
    case 'forward':
      return mod(targetStep - basicTick, N);
    case 'reverse':
      return mod(N - 1 - targetStep - basicTick, N);
    case 'pendulum':
      return mod(targetStep - basicTick, 2 * (N - 1));
  }
}

/**
 * Compute the new phaseOffset to install when the user changes mode, speed,
 * or steps. The intent: localStep at the moment of the change should stay
 * the same — no audible jump, no playhead teleport.
 *
 * Pure function: takes the current `g`, the old config (to read S now), and
 * the new config (to solve for the new offset). Returns an integer.
 */
export function computePhaseOffsetForChange(
  g: number,
  oldMode: PlaybackMode,
  oldSpeed: PlaybackSpeed,
  oldOffset: number,
  oldN: number,
  newMode: PlaybackMode,
  newSpeed: PlaybackSpeed,
  newN: number,
): number {
  const currentStep = localStep(g, oldMode, oldSpeed, oldOffset, oldN);
  if (currentStep < 0) return 0; // degenerate old config → no preservation possible
  const newBasic = Math.floor(g / divider(newSpeed));
  // Clamp the target step into the new pattern length (relevant when N shrinks).
  const targetStep = newN > 0 ? currentStep % newN : 0;
  return offsetForStep(newMode, newN, targetStep, newBasic);
}

/**
 * Length in 32n master ticks of one full playback cycle for this config.
 * Useful for O(1)-amortized analytics (e.g. how many onsets per period) and
 * for sanity tests. Pendulum's cycle is 2(N-1) local ticks.
 */
export function playbackPeriodLocalTicks(mode: PlaybackMode, N: number): number {
  if (N <= 1) return 1;
  return mode === 'pendulum' ? 2 * (N - 1) : N;
}
