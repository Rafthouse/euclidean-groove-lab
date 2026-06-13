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
  | 'eq2'
  | 'compressor'
  | 'deliveryDelay'
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

export type EqBandType =
  | 'bell'
  | 'lowShelf'
  | 'highShelf'
  | 'lowCut'
  | 'highCut'
  | 'notch'
  | 'bandPass'
  | 'tilt';

export interface EqBandParams {
  enabled: boolean;
  type: EqBandType;
  frequency: number;  // 20..20000 Hz
  gain: number;       // -24..+24 dB
  Q: number;          // 0.1..20
}

export interface Eq2Params {
  bands: EqBandParams[];  // 8 bands
  analyzerMode: 'off' | 'pre' | 'post';
  analyzerFftSize: 1024 | 2048 | 4096 | 8192;
  /** Future mid/side. V1: stereo only. */
  mode: 'stereo';
}

export const BAND_COLORS = ['#ff4444','#ff8800','#ffcc00','#44dd44','#00dddd','#4488ff','#aa44ff','#ff44aa'];

function defaultEqBand(idx: number): EqBandParams {
  const types: EqBandType[] = ['bell','bell','bell','bell','bell','bell','bell','bell'];
  const freqs = [60, 150, 400, 1000, 2500, 6000, 12000, 18000];
  return { enabled: idx < 4, type: types[idx], frequency: freqs[idx], gain: 0, Q: 1 };
}

export interface MultiBandParams {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  makeup: number;
  solo: boolean;
  mute: boolean;
  bypass: boolean;
}

function defaultMB(): MultiBandParams {
  return { threshold: -24, ratio: 4, attack: 0.003, release: 0.25, makeup: 0, solo: false, mute: false, bypass: false };
}

export interface CompressorParams {
  threshold: number;      // -60..0 dB, default -24
  ratio: number;          // 1..20, default 4
  attack: number;         // 0.0001..0.5 s (0.1–500ms), default 0.003
  release: number;        // 0.005..5 s (5–5000ms), default 0.25
  knee: number;           // 0..1 (0=hard, 1=soft), default 0
  makeup: number;         // -24..+24 dB, default 0
  dryWet: number;         // 0..1, default 1
  lookahead: number;      // seconds: 0 (OFF), 0.001, 0.005, 0.01
  mode: 'standard' | 'multiband';
  /** Sidechain source track id, or null = internal (no sidechain). */
  sidechainSource: string | null;
  sidechainFilterType: 'off' | 'highpass' | 'lowpass' | 'bandpass';
  sidechainFilterFreq: number;
  detector: 'rms' | 'peak';
  /** Multiband crossovers (Hz). */
  mbCrossoverLow: number;   // default 120
  mbCrossoverHigh: number;  // default 4000
  mbLow: MultiBandParams;
  mbMid: MultiBandParams;
  mbHigh: MultiBandParams;
}

export interface DelayParams {
  time: number;       // 0.01..1 s, default 0.25
  feedback: number;   // 0..0.99, default 0.3
  mix: number;        // 0..1 (wet/dry), default 0.5
}

export interface DeliveryDelayParams extends Record<string, number> {
  delayTime: number;   // 0.001–2 s
  feedback: number;    // 0–0.99
  mix: number;         // 0–1
  pingPong: number;    // 0/1
  filterLp: number;    // 0–1
  filterHp: number;    // 0–1
  saturation: number;  // 0–1
  modRate: number;     // 0–20 Hz
  modDepth: number;    // 0–1
  duckThreshold: number; // 0–1
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
  | Eq2Params
  | CompressorParams
  | DeliveryDelayParams
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
  eq2: {
    bands: Array.from({ length: 8 }, (_, i) => defaultEqBand(i)),
    analyzerMode: 'off',
    analyzerFftSize: 2048,
    mode: 'stereo',
  },
  compressor: {
    threshold: -24, ratio: 4, attack: 0.003, release: 0.25,
    knee: 0, makeup: 0, dryWet: 1, lookahead: 0,
    mode: 'standard',
    sidechainSource: null,
    sidechainFilterType: 'off', sidechainFilterFreq: 1000,
    detector: 'rms',
    mbCrossoverLow: 120, mbCrossoverHigh: 4000,
    mbLow: defaultMB(), mbMid: defaultMB(), mbHigh: defaultMB(),
  },
  delay: { time: 0.25, feedback: 0.3, mix: 0.5 },
  deliveryDelay: {
    delayTime: 0.25, feedback: 0.3, mix: 0.5,
    pingPong: 0, filterLp: 0, filterHp: 0,
    saturation: 0, modRate: 0, modDepth: 0,
    duckThreshold: 0,
  },
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
  eq2: 'SHCHUR EQ',
  deliveryDelay: 'Delivery Delay',
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
