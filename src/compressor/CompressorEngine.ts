/**
 * Compressor DSP Engine.
 *
 * Wraps Tone.js nodes for the compressor effect. Handles:
 *   – Tone.Compressor for core dynamics
 *   – Post-compressor makeup gain
 *   – Dry/wet crossfade via parallel blend
 *   – Sidechain delay for lookahead
 *   – Multiband splitting via Tone.Filter + per-band compressors
 *
 * V1 uses Tone.Compressor as the workhorse. Future versions can
 * replace it with a custom WaveShaper/envelope-follower chain for
 * soft-knee and RMS mode.
 */

import * as Tone from 'tone';
import type {
  CompressorParams,
  MultiBandParams,
} from '../mixer/fxTypes';

// ── Helpers ────────────────────────────────────────────────────────────

function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

function clampDb(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── Compressor Node Builder ────────────────────────────────────────────

interface CompressorNodes {
  input: Tone.ToneAudioNode;
  output: Tone.ToneAudioNode;
  /** The compressor node itself (for sidechain input). */
  compressor: Tone.Compressor;
  /** The makeup gain node (post-compressor). */
  makeupNode: Tone.Gain;
  /** The dry/wet crossfade nodes. */
  dryGain: Tone.Gain;
  wetGain: Tone.Gain;
  /** Sidechain delay for lookahead (if > 0). */
  lookaheadDelay?: Tone.Delay;
  dispose: () => void;
  update: (p: CompressorParams) => void;
}

/**
 * Build a standard compressor effect chain:
 *
 *   Input ─→ [Lookahead Delay] ─→ [Tone.Compressor] ─→ [Makeup Gain] ─┐
 *                                                                      ├→ Σ → Output
 *   Input ───────────────────────────────────────────────────────────→ [Dry Gain] ─┘
 */
export function buildStandardCompressor(p: CompressorParams): CompressorNodes {
  const dryGain = new Tone.Gain(1);
  const wetGain = new Tone.Gain(1);
  const makeupNode = new Tone.Gain(dbToGain(clampDb(p.makeup, -24, 24)));
  const comp = new Tone.Compressor({
    threshold: clampDb(p.threshold, -60, 0),
    ratio: Math.max(1, Math.min(20, p.ratio)),
    attack: Math.max(0.0001, Math.min(0.5, p.attack)),
    release: Math.max(0.005, Math.min(5, p.release)),
  });

  // Lookahead: delay the dry path to align with the compressed wet path
  const lookaheadMs = p.lookahead || 0;
  let lookaheadDelay: Tone.Delay | undefined;
  let wetSource: Tone.ToneAudioNode = comp;

  if (lookaheadMs > 0) {
    lookaheadDelay = new Tone.Delay(lookaheadMs, lookaheadMs);
    comp.connect(lookaheadDelay);
    wetSource = lookaheadDelay;
  }

  wetSource.connect(makeupNode);
  makeupNode.connect(wetGain);

  // Summing node
  const summer = new Tone.Gain(1);
  dryGain.connect(summer);
  wetGain.connect(summer);

  // Dry/wet mix
  const dryWet = clampDb(p.dryWet ?? 100, 0, 100) / 100;
  dryGain.gain.value = 1 - dryWet;
  wetGain.gain.value = dryWet;

  const dispose = () => {
    try { dryGain.disconnect(); dryGain.dispose(); } catch {}
    try { wetGain.disconnect(); wetGain.dispose(); } catch {}
    try { makeupNode.disconnect(); makeupNode.dispose(); } catch {}
    try { comp.disconnect(); comp.dispose(); } catch {}
    try { summer.disconnect(); summer.dispose(); } catch {}
    if (lookaheadDelay) {
      try { lookaheadDelay.disconnect(); lookaheadDelay.dispose(); } catch {}
    }
  };

  const update = (next: CompressorParams) => {
    comp.set({
      threshold: clampDb(next.threshold, -60, 0),
      ratio: Math.max(1, Math.min(20, next.ratio)),
      attack: Math.max(0.0001, Math.min(0.5, next.attack)),
      release: Math.max(0.005, Math.min(5, next.release)),
    });
    makeupNode.gain.value = dbToGain(clampDb(next.makeup, -24, 24));
    const dw = clampDb(next.dryWet ?? 100, 0, 100) / 100;
    dryGain.gain.rampTo(1 - dw, 0.01);
    wetGain.gain.rampTo(dw, 0.01);
  };

  return {
    input: comp,
    output: summer,
    compressor: comp,
    makeupNode,
    dryGain,
    wetGain,
    lookaheadDelay,
    dispose,
    update,
  };
}

// ── Multiband Compressor ───────────────────────────────────────────────

interface MbBandNodes {
  filter: Tone.Filter;
  comp: Tone.Compressor;
  makeup: Tone.Gain;
  muteGain?: Tone.Gain;
}

interface MultibandCompressorNodes {
  input: Tone.ToneAudioNode;
  output: Tone.ToneAudioNode;
  bands: {
    low: MbBandNodes;
    mid: MbBandNodes;
    high: MbBandNodes;
  };
  summer: Tone.Gain;
  dispose: () => void;
  update: (p: CompressorParams) => void;
}

/**
 * Build a multiband compressor:
 *
 *   Input ─→ [LPF @ crossoverLow]  ─→ [Band Comp] ─→ [Makeup] ─┐
 *          → [BPF @ crossoverLow..high] → [Band Comp] → [Makeup] ├→ Summer → Output
 *          → [HPF @ crossoverHigh]  ─→ [Band Comp] → [Makeup] ─┘
 */
export function buildMultibandCompressor(p: CompressorParams): MultibandCompressorNodes {
  const lo = p.mbCrossoverLow ?? 120;
  const hi = p.mbCrossoverHigh ?? 4000;

  const lowFilter = new Tone.Filter(lo, 'lowpass');
  const midFilter = new Tone.BiquadFilter({
    type: 'bandpass',
    frequency: Math.sqrt(lo * hi),
    Q: lo / (hi - lo) || 1,
  });
  const highFilter = new Tone.Filter(hi, 'highpass');

  function makeBand(bp: MultiBandParams): MbBandNodes {
    const comp = new Tone.Compressor({
      threshold: clampDb(bp.threshold, -60, 0),
      ratio: Math.max(1, Math.min(20, bp.ratio)),
      attack: Math.max(0.0001, Math.min(0.5, bp.attack)),
      release: Math.max(0.005, Math.min(5, bp.release)),
    });
    const makeup = new Tone.Gain(dbToGain(clampDb(bp.makeup, -24, 24)));
    comp.connect(makeup);
    return { filter: comp as any, comp, makeup };
  }

  const low = makeBand(p.mbLow);
  const mid = makeBand(p.mbMid);
  const high = makeBand(p.mbHigh);

  // Wire filters to band compressors
  lowFilter.connect(low.comp);
  midFilter.connect(mid.comp);
  highFilter.connect(high.comp);

  // Summer
  const summer = new Tone.Gain(1);
  const lowSummerIn = new Tone.Gain(1);
  const midSummerIn = new Tone.Gain(1);
  const highSummerIn = new Tone.Gain(1);

  low.comp.connect(low.makeup);
  low.makeup.connect(lowSummerIn);
  lowSummerIn.connect(summer);

  mid.comp.connect(mid.makeup);
  mid.makeup.connect(midSummerIn);
  midSummerIn.connect(summer);

  high.comp.connect(high.makeup);
  high.makeup.connect(highSummerIn);
  highSummerIn.connect(summer);

  // Input: split signal to three filters
  const input = new Tone.Gain(1);
  input.connect(lowFilter);
  input.connect(midFilter);
  input.connect(highFilter);

  const dispose = () => {
    [lowFilter, midFilter, highFilter, input, summer,
     lowSummerIn, midSummerIn, highSummerIn,
     low.comp, low.makeup, mid.comp, mid.makeup, high.comp, high.makeup,
    ].forEach((n) => { try { n.disconnect(); n.dispose(); } catch {} });
  };

  const update = (next: CompressorParams) => {
    const newLo = next.mbCrossoverLow ?? 120;
    const newHi = next.mbCrossoverHigh ?? 4000;
    lowFilter.set({ frequency: newLo });
    midFilter.set({
      frequency: Math.sqrt(newLo * newHi),
      Q: newLo / (newHi - newLo) || 1,
    });
    highFilter.set({ frequency: newHi });

    function applyBand(bp: MultiBandParams, nodes: MbBandNodes) {
      nodes.comp.set({
        threshold: clampDb(bp.threshold, -60, 0),
        ratio: Math.max(1, Math.min(20, bp.ratio)),
        attack: Math.max(0.0001, Math.min(0.5, bp.attack)),
        release: Math.max(0.005, Math.min(5, bp.release)),
      });
      nodes.makeup.gain.value = dbToGain(clampDb(bp.makeup, -24, 24));
    }
    applyBand(next.mbLow, low);
    applyBand(next.mbMid, mid);
    applyBand(next.mbHigh, high);

    // Solo/mute: when any band is solo'd, mute non-solo bands
    const hasSolo = next.mbLow.solo || next.mbMid.solo || next.mbHigh.solo;
    lowSummerIn.gain.rampTo(!hasSolo || next.mbLow.solo ? (next.mbLow.mute ? 0 : (next.mbLow.bypass ? 1 : 1)) : 0, 0.01);
    midSummerIn.gain.rampTo(!hasSolo || next.mbMid.solo ? (next.mbMid.mute ? 0 : (next.mbMid.bypass ? 1 : 1)) : 0, 0.01);
    highSummerIn.gain.rampTo(!hasSolo || next.mbHigh.solo ? (next.mbHigh.mute ? 0 : (next.mbHigh.bypass ? 1 : 1)) : 0, 0.01);
    // Bypassed bands pass through at unity
    if (next.mbLow.bypass) {
      low.comp.set({ threshold: 0, ratio: 1 });
      low.makeup.gain.value = 1;
    }
    if (next.mbMid.bypass) {
      mid.comp.set({ threshold: 0, ratio: 1 });
      mid.makeup.gain.value = 1;
    }
    if (next.mbHigh.bypass) {
      high.comp.set({ threshold: 0, ratio: 1 });
      high.makeup.gain.value = 1;
    }
  };

  return {
    input,
    output: summer,
    bands: { low, mid, high },
    summer,
    dispose,
    update,
  };
}
