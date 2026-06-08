/**
 * Core data types for the rhythm engine.
 *
 * The engine is intentionally PURE: no Tone.js, no React, no DOM. Every
 * function takes plain values and returns plain values, so the whole groove
 * pipeline (pulse -> euclid -> rotate -> accent -> phase -> microtiming) can be
 * unit-tested in isolation. Audio and UI are downstream consumers only.
 */

/**
 * A rhythmic pattern on a discrete, isochronous grid.
 * `true` = onset (a sounded pulse); `false` = a silent step.
 * Index 0 is the downbeat. Patterns are cyclic: the step after the last
 * wraps back to index 0.
 */
export type Pattern = boolean[];
