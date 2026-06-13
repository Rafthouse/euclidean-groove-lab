import type { FxChain } from './fxTypes';

/**
 * Mixer state model.
 *
 * Each instrument track gets a mixer channel. The master channel controls the
 * final stereo output. Instrument Volume (track.volume, 0–100) and Mixer Fader
 * (dB, +12 to -∞, default 0 dB) are SEPARATE stages in the signal path.
 *
 * Signal flow:
 *   Instrument Generator
 *   → Instrument Volume (track.volume)
 *   → Mixer Channel
 *     → Channel Gain (pre-fader, from instrument)
 *     → FX Chain (ordered insert effects)
 *     → Channel Fader (dB)
 *     → Pan (L100 ↔ Center ↔ R100, equal-power)
 *   → Master Bus
 *     → Master FX Chain
 *     → Master Fader (dB)
 *   → Audio Output
 *
 * Mute/Solo exist in BOTH the instrument card and the mixer strip. Both
 * locations control the same track.mute / track.solo state — kept in sync
 * via the same callback.
 */

export interface MixerChannelState {
  /** The track id this channel corresponds to, or 'master' for the master bus. */
  id: string;
  /** Display name (e.g. "Kick", "Master"). */
  name: string;
  /** Channel fader in dB. Range: +12 to -∞. Default 0 (unity gain). */
  faderDb: number;
  /** Pan value: -100 (full left) to +100 (full right), 0 = center. */
  pan: number;
  /** REC arm state. Gray = inactive, Red = armed. For future stem recording. */
  rec: boolean;
  /** FX chain (ordered insert effects). Empty array = bypass. */
  fxChain: FxChain;
  /** FX rack panel open/closed (UI state, not persisted). */
  fxRackOpen: boolean;
}

export type MixerConfig = MixerChannelState[];

/** Default fader value: 0 dB = unity gain. */
export const DEFAULT_FADER_DB = 0;

/** Fader range. */
export const FADER_MAX_DB = 12;   // +12 dB
export const FADER_MIN_DB = -60;  // -60 dB (effectively -∞ below -60)

/** Pan range. */
export const PAN_MAX = 100;  // L100 / R100

/**
 * Convert a logarithmic fader dB value to a linear gain factor (0–1+).
 * 0 dB → 1.0, +12 dB → ~3.98, -60 dB → ~0.001.
 */
export function faderDbToGain(db: number): number {
  // Clamp to avoid Infinity
  const clamped = Math.max(FADER_MIN_DB, Math.min(FADER_MAX_DB, db));
  return Math.pow(10, clamped / 20);
}

/**
 * Convert a linear gain factor back to dB for display.
 */
export function gainToFaderDb(gain: number): number {
  if (gain <= 0) return FADER_MIN_DB;
  return Math.max(FADER_MIN_DB, Math.min(FADER_MAX_DB, 20 * Math.log10(gain)));
}

/**
 * Equal-power pan law: convert pan (-100 to +100) to left/right gain.
 * -100 = full left, 0 = center, +100 = full right.
 * Equal-power means constant perceived loudness across the stereo field.
 */
export function panToGains(pan: number): { left: number; right: number } {
  const normalized = Math.max(-PAN_MAX, Math.min(PAN_MAX, pan)) / PAN_MAX; // -1 to 1
  // Equal-power: L = cos(θ), R = sin(θ), where θ goes 0→π/2
  const theta = (normalized + 1) * Math.PI / 4; // 0 at L100, π/4 at center, π/2 at R100
  return {
    left: Math.cos(theta),
    right: Math.sin(theta),
  };
}

/** Create default mixer channels matching the standard 4 instrument voices + master. */
export function defaultMixerConfig(includeGhost: boolean = false): MixerConfig {
  const emptyChain = () => ({ fxChain: [], fxRackOpen: false });
  const channels: MixerChannelState[] = [
    { id: 'kick',   name: 'Kick',  faderDb: DEFAULT_FADER_DB, pan: 0, rec: false, ...emptyChain() },
    { id: 'snare',  name: 'Snare', faderDb: DEFAULT_FADER_DB, pan: 0, rec: false, ...emptyChain() },
    { id: 'hat',    name: 'Hat',   faderDb: DEFAULT_FADER_DB, pan: 0, rec: false, ...emptyChain() },
    { id: 'bass',   name: 'Bass',  faderDb: DEFAULT_FADER_DB, pan: 0, rec: false, ...emptyChain() },
  ];
  if (includeGhost) {
    channels.splice(2, 0, { id: 'ghost', name: 'Ghost', faderDb: DEFAULT_FADER_DB, pan: 0, rec: false, ...emptyChain() });
  }
  channels.push({ id: 'master', name: 'Master', faderDb: DEFAULT_FADER_DB, pan: 0, rec: false, ...emptyChain() });
  return channels;
}
