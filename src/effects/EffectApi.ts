/**
 * Spielzeug Effect API.
 *
 * Unified interface for all premium effects.
 *
 * Every effect module must implement this contract:
 *
 *   DSP Layer (AudioWorklet / Tone.js / WASM)
 *         │
 *   Adapter Layer (unified param mapping, state serialization)
 *         │
 *   Effect Window (custom React UI)
 *
 * ── Lifecycle ──
 *   1. User adds effect to FX Rack (FxSlot created)
 *   2. User clicks "Open" → Effect Window renders
 *   3. Window mounts → DSP engine instantiates
 *   4. User tweaks params → onChange → engine.update()
 *   5. Window closes → engine.dispose()
 *
 * ── Presets ──
 *   Each effect stores presets in its FxSlot.params (serializable JSON).
 *   A/B slots managed by the UI, saved to param snapshot.
 *
 * ── Analyzer ──
 *   Optional. If present, connects to EffectWindow visualizer.
 */

import type { Tone } from 'tone';

// ── Parameter metadata ───────────────────────────────────────────────

export type ParamType =
  | 'float'
  | 'int'
  | 'boolean'
  | 'enum'
  | 'percent'
  | 'dB'
  | 'ms'
  | 's'
  | 'Hz'
  | 'kHz'
  | 'ratio';

export interface ParamMeta {
  /** Internal ID (matches key in param state). */
  id: string;
  /** Display name. */
  name: string;
  /** Data type for rendering. */
  type: ParamType;
  /** Minimum value. */
  min: number;
  /** Maximum value. */
  max: number;
  /** Step / precision. */
  step: number;
  /** Default value. */
  default: number;
  /** Unit string for display (dB, %, ms, Hz, :1). */
  unit: string;
  /** Optional enum labels (for type='enum'). */
  enumLabels?: string[];
  /** Automation index for future clip automation. */
  automationIndex?: number;
}

// ── Engine interface ─────────────────────────────────────────────────

export interface EffectEngine {
  /** Connect source to input. */
  input: Tone.ToneAudioNode;
  /** Take output from here. */
  output: Tone.ToneAudioNode;
  /** Optional analyser for visualizer. */
  analyser?: Tone.Analyser;
  /** Update a single parameter (with smoothing). */
  setParam: (id: string, value: number) => void;
  /** Bulk update from param snapshot. */
  setParams: (params: Record<string, number>) => void;
  /** Bypass (true = signal passes through unchanged). */
  setBypass: (bypass: boolean) => void;
  /** Full teardown. */
  dispose: () => void;
}

// ── UI component contract ────────────────────────────────────────────

export interface EffectModule {
  /** Unique effect type ID (matches BuiltInEffectType). */
  type: string;
  /** Display name. */
  name: string;
  /** Parameter metadata for auto-generated UIs. */
  paramMeta: ParamMeta[];
  /** Default parameter values. */
  defaultParams: Record<string, number>;
  /** Create DSP engine instance. */
  createEngine: (params: Record<string, number>) => EffectEngine;
  /** React component for the effect window. */
  Window: React.ComponentType<{
    params: Record<string, number>;
    onChange: (params: Record<string, number>) => void;
    onClose: () => void;
    channelName: string;
  }>;
}

// ── Parameter formatting ─────────────────────────────────────────────

export function formatParamValue(meta: ParamMeta, value: number): string {
  switch (meta.type) {
    case 'dB':
      return `${value >= 0 ? '+' : ''}${value.toFixed(meta.step >= 1 ? 0 : 1)} dB`;
    case 'percent':
      return `${(value * 100).toFixed(0)}%`;
    case 'ms':
      return `${(value * 1000).toFixed(0)} ms`;
    case 's':
      return `${value.toFixed(2)} s`;
    case 'Hz':
      return value >= 1000 ? `${(value / 1000).toFixed(2)} kHz` : `${value.toFixed(0)} Hz`;
    case 'kHz':
      return `${value.toFixed(2)} kHz`;
    case 'ratio':
      return `${value.toFixed(1)}:1`;
    case 'enum':
      return meta.enumLabels?.[Math.round(value)] ?? `${value}`;
    case 'int':
      return `${Math.round(value)}`;
    case 'boolean':
      return value >= 0.5 ? 'ON' : 'OFF';
    default:
      return value.toFixed(meta.step >= 1 ? 0 : 2);
  }
}
