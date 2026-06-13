/**
 * FX Rack state model.
 *
 * Each mixer channel (including Master) has an fxChain: an ordered list of
 * FX slots. Each slot references a built-in effect + its parameter snapshot.
 * The architecture is designed so that an ExternalPlugin type can be added
 * later for VST/CLAP hosting (browser-impossible, but the union type is
 * ready).
 *
 * Signal flow per channel:
 *   Channel Gain (pre-fader) → FX Insert 1 → FX 2 → … → FX N → Panner → Fader
 *
 * DSP policy:
 *   - Effects are instantiated ONLY when inserted (no allocation for empty slots)
 *   - Disabled effects bypass their processing node
 *   - No CPU consumed for empty or disabled slots
 */

// ── Effect types ──────────────────────────────────────────────────────

export type BuiltInEffectType =
  | 'eq'
  | 'compressor'
  | 'delay'
  | 'reverb'
  | 'chorus'
  | 'distortion'
  | 'filter'
  | 'limiter'
  | 'stereoWidth'
  | 'gate';

/** Discriminated union for future external plugin support. */
export type FxPluginType = BuiltInEffectType;

// ── Built-in effect parameter snapshots ────────────────────────────────

export interface EqParams {
  low: number;       // -30..+30 dB
  mid: number;       // -30..+30 dB
  high: number;      // -30..+30 dB
  lowFreq: number;   // Hz, default 250
  highFreq: number;  // Hz, default 4000
}

export interface CompressorParams {
  threshold: number;  // -60..0 dB, default -24
  ratio: number;      // 1..20, default 4
  attack: number;     // 0..0.1 s, default 0.003
  release: number;    // 0..1 s, default 0.25
  knee: number;       // 0..1 (0=hard, 1=soft), default 0
  makeup: number;     // -12..+12 dB, default 0
  dryWet: number;     // 0..1, default 1
  /** Sidechain source track id, or null = internal (no sidechain). */
  sidechainSource: string | null;
}

export interface DelayParams {
  time: number;       // 0.01..1 s, default 0.25
  feedback: number;   // 0..0.99, default 0.3
  mix: number;        // 0..1 (wet/dry), default 0.5
}

export interface ReverbParams {
  decay: number;      // 0.1..10 s, default 1.5
  preDelay: number;   // 0..0.1 s, default 0.01
  mix: number;        // 0..1, default 0.3
}

export interface ChorusParams {
  frequency: number;  // 0.1..10 Hz, default 1.5
  delayTime: number;  // 1..30 ms, default 3
  depth: number;      // 0..1, default 0.5
  mix: number;        // 0..1, default 0.5
}

export interface DistortionParams {
  distortion: number; // 0..1, default 0.4
  oversample: 'none' | '2x' | '4x'; // default 'none'
}

export interface FilterParams {
  frequency: number;  // 20..20000 Hz, default 1000
  type: 'lowpass' | 'highpass' | 'bandpass' | 'notch' | 'lowshelf' | 'highshelf' | 'peaking';
  rolloff: -12 | -24 | -48; // default -12
  Q: number;          // 0.1..20, default 1
  gain: number;       // -40..+40 dB (used by shelving/peaking filters), default 0
}

export interface LimiterParams {
  threshold: number;  // -60..0 dB, default -6
  attack: number;     // 0.001..0.02 s, default 0.005
  release: number;    // 0.01..0.1 s, default 0.05
}

export interface StereoWidthParams {
  width: number;      // 0..1 (0=mono, 1=full stereo), default 1
}

export interface GateParams {
  threshold: number;  // -60..0 dB, default -40
  attack: number;     // 0..0.05 s, default 0.001
  release: number;    // 0.01..1 s, default 0.1
  hold: number;       // 0..1 s, default 0.05
}

export type FxParams =
  | EqParams
  | CompressorParams
  | DelayParams
  | ReverbParams
  | ChorusParams
  | DistortionParams
  | FilterParams
  | LimiterParams
  | StereoWidthParams
  | GateParams;

// ── Default parameters ────────────────────────────────────────────────

export const DEFAULT_PARAMS: Record<BuiltInEffectType, FxParams> = {
  eq: { low: 0, mid: 0, high: 0, lowFreq: 250, highFreq: 4000 },
  compressor: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25, knee: 0, makeup: 0, dryWet: 1, sidechainSource: null },
  delay: { time: 0.25, feedback: 0.3, mix: 0.5 },
  reverb: { decay: 1.5, preDelay: 0.01, mix: 0.3 },
  chorus: { frequency: 1.5, delayTime: 3, depth: 0.5, mix: 0.5 },
  distortion: { distortion: 0.4, oversample: 'none' },
  filter: { frequency: 1000, type: 'lowpass', rolloff: -12, Q: 1, gain: 0 },
  limiter: { threshold: -6, attack: 0.005, release: 0.05 },
  stereoWidth: { width: 1 },
  gate: { threshold: -40, attack: 0.001, release: 0.1, hold: 0.05 },
};

// ── FX Slot ───────────────────────────────────────────────────────────

export interface FxSlot {
  /** Unique instance id within the chain (for React keys). */
  id: string;
  /** The effect type. */
  type: BuiltInEffectType;
  /** Whether the effect is currently processing. */
  enabled: boolean;
  /** Current parameter snapshot. */
  params: FxParams;
}

/**
 * FX chain per mixer channel.
 * Empty array = bypass (no DSP allocation in audio layer).
 */
export type FxChain = FxSlot[];

// ── Helpers ───────────────────────────────────────────────────────────

let _slotCounter = 0;

/** Generate a unique slot id. */
export function nextSlotId(): string {
  _slotCounter += 1;
  return `fx-${_slotCounter}-${Date.now().toString(36)}`;
}

/** Reset the slot counter (useful for test isolation). */
export function resetSlotCounter(): void {
  _slotCounter = 0;
}

/** Create a default FX slot for a given effect type. */
export function createFxSlot(type: BuiltInEffectType): FxSlot {
  return {
    id: nextSlotId(),
    type,
    enabled: true,
    params: { ...DEFAULT_PARAMS[type] },
  };
}

/** Human-readable display names for each effect type. */
export const FX_TYPE_NAMES: Record<BuiltInEffectType, string> = {
  eq: 'EQ',
  compressor: 'Compressor',
  delay: 'Delay',
  reverb: 'Reverb',
  chorus: 'Chorus',
  distortion: 'Distortion',
  filter: 'Filter',
  limiter: 'Limiter',
  stereoWidth: 'Stereo Width',
  gate: 'Gate',
};
