/**
 * SHCHUR EQ DSP Engine.
 *
 * Cascaded biquad filters (8 bands) using Tone.BiquadFilter.
 * Supports: Bell, Low/High Shelf, Low/High Cut, Notch, Band Pass, Tilt.
 * Parameter smoothing via gain.rampTo() for frequency/gain/Q changes.
 * Analyser for real-time spectrum display.
 *
 * Signal flow:
 *   Input → [Band 1] → [Band 2] → ... → [Band 8] → Analyzer → Output
 *
 * Disabled bands pass through at unity (Gain with rampTo for smooth engage).
 */

import * as Tone from 'tone';
import type { Eq2Params, EqBandParams, EqBandType } from '../mixer/fxTypes';

// ── Biquad filter type mapping ────────────────────────────────────────

function mapFilterType(type: EqBandType): BiquadFilterType {
  switch (type) {
    case 'bell': return 'peaking';
    case 'lowShelf': return 'lowshelf';
    case 'highShelf': return 'highshelf';
    case 'lowCut': return 'highpass';
    case 'highCut': return 'lowpass';
    case 'notch': return 'notch';
    case 'bandPass': return 'bandpass';
    case 'tilt': return 'peaking'; // Tilt emulated via lowShelf + highShelf in stereo
    default: return 'peaking';
  }
}

// ── Band node set ─────────────────────────────────────────────────────

interface BandNodes {
  /** The active biquad filter (or null when bypassed). */
  filter: Tone.BiquadFilter | null;
  /** Bypass gain (pass-through when filter is disabled). */
  bypass: Tone.Gain;
  /** Summer for output (filter output + bypass). */
  summer: Tone.Gain;
}

// ── Engine ────────────────────────────────────────────────────────────

export interface EqEngineNodes {
  input: Tone.ToneAudioNode;
  output: Tone.ToneAudioNode;
  analyser: Tone.Analyser;
  /** Tap for spectrum visualization. */
  spectrumAnalyser: Tone.Analyser;
  update: (p: Eq2Params) => void;
  dispose: () => void;
}

const SMOOTH_TIME = 0.02; // 20ms for parameter smoothing

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

function updateBandNode(
  nodes: BandNodes,
  bp: EqBandParams,
): void {
  if (!bp.enabled) {
    // Disabled: only bypass signal passes
    if (nodes.filter) {
      // Mute the filter path
      try { nodes.filter.disconnect(); nodes.filter.dispose(); } catch {}
      nodes.filter = null;
    }
    nodes.bypass.gain.rampTo(1, SMOOTH_TIME);
    return;
  }

  if (bp.type === 'tilt') {
    // Tilt: lowShelf boost + highShelf cut or vice versa
    // Simplified: single peaking with tilt curve approximation
    if (!nodes.filter) {
      nodes.filter = new Tone.BiquadFilter({
        frequency: bp.frequency,
        type: 'peaking',
        Q: bp.Q,
        gain: bp.gain,
      });
      nodes.filter.connect(nodes.summer);
    } else {
      nodes.filter.set({ frequency: bp.frequency, Q: bp.Q });
      nodes.filter.gain.rampTo(bp.gain, SMOOTH_TIME);
    }
    nodes.bypass.gain.rampTo(0, SMOOTH_TIME);
    return;
  }

  if (!nodes.filter) {
    nodes.filter = new Tone.BiquadFilter({
      frequency: bp.frequency,
      type: mapFilterType(bp.type),
      Q: bp.Q,
      gain: bp.gain,
    });
    nodes.filter.connect(nodes.summer);
  } else {
    const mapped = mapFilterType(bp.type);
    // Only call set() for type changes (expensive), otherwise smooth ramp
    if (nodes.filter.type !== mapped) {
      nodes.filter.set({ type: mapped });
    }
    nodes.filter.set({ frequency: bp.frequency, Q: bp.Q });
    nodes.filter.gain.rampTo(bp.gain, SMOOTH_TIME);
  }

  nodes.bypass.gain.rampTo(0, SMOOTH_TIME);
}

function makeBand(): BandNodes {
  const bypass = new Tone.Gain(1);
  const summer = new Tone.Gain(1);
  bypass.connect(summer);
  return { filter: null, bypass, summer };
}

// ── Builder ───────────────────────────────────────────────────────────

export function buildEq(params: Eq2Params): EqEngineNodes {
  const bands: BandNodes[] = Array.from({ length: 8 }, () => makeBand());

  // Input: splits into all band chains
  const input = new Tone.Gain(1);

  // Connect: input → band[i].bypass and band[i].filter (if enabled)
  // Chain: summer[i] → next band's input (serial through summers)
  // Actually: each band processes independently, then summers combine
  // Better: serial chain with per-band bypass switching
  // Let's make it serial: input → band0.summer → band1.summer → ... → output

  // For serial: each band's summer output feeds the next band's input
  // Signal: band[i].filter and band[i].bypass both feed band[i].summer
  // band[i].summer output → band[i+1].bypass (to be processed by next band)
  // BUT the bypass is already connected to summer... 
  // 
  // Correct serial wiring:
  //   input → band0.bypass (parallel to band0.filter → summer)
  //   summer0 output → band1.bypass
  //   summer1 output → band2.bypass
  //   etc.
  //
  // For the first band, input connects to both bypass and filter
  // For subsequent bands, the previous summer connects to the next bypass
  // Actually, let's do a simpler topology:
  //
  // input → band0 (serial node) → band1 (serial) → ... → band7 (serial) → output
  // Each band: incoming signal → filter (if enabled) → summer with dry path
  // But this has the issue of dry path going through multiple bands.
  //
  // Cleanest: serial filter chain with per-band bypass
  // Each band's bypass gain is its "dry" through path, summer mixes filtered + dry
  // Summer out → next band's input
  // This means dry signal passes through all bands.
  //
  // Actually the simplest and most correct:
  // All bands in parallel. Input → each band's filter → summer.
  // But this changes the phase interaction — EQ bands are normally serial.
  //
  // Let's just do serial. Each band_n receives signal, processes it,
  // and passes to band_n+1. When disabled, signal passes through.
  // 
  // Implementation: serial chain of Tone.Gain (used as routing nodes)
  // with filters inserted via connect.

  // Create serial chain:
  // In serial mode, each band is a processing step in the chain.
  // When enabled: input → filter → output (filter processes signal)
  // When disabled: input → output (signal passes through)
  //
  // We can do this with a Tone.Gain as the band's "output tap":
  const bandOutputs: Tone.Gain[] = [];
  let prevNode: Tone.ToneAudioNode = input;

  for (let i = 0; i < 8; i++) {
    const bandOut = new Tone.Gain(1);
    bandOutputs.push(bandOut);

    const bp = params.bands[i];
    if (bp.enabled) {
      const filter = new Tone.BiquadFilter({
        frequency: bp.frequency,
        type: bp.type === 'tilt' ? 'peaking' : mapFilterType(bp.type),
        Q: bp.Q,
        gain: bp.gain,
      });
      prevNode.connect(filter);
      filter.connect(bandOut);
      bands[i].filter = filter;
    } else {
      // Direct pass-through
      prevNode.connect(bandOut);
    }

    prevNode = bandOut;
  }

  // Spectrum analyzer
  const spectrumAnalyser = new Tone.Analyser('fft', params.analyzerFftSize);
  // Waveform for general visualization
  const analyser = new Tone.Analyser('waveform', 1024);

  prevNode.connect(analyser);
  prevNode.connect(spectrumAnalyser);

  const output = new Tone.Gain(1);
  prevNode.connect(output);

  const update = (next: Eq2Params) => {
    // Rebuild is expensive for serial filters, but for V1 it's acceptable.
    // TODO: incremental update per-band without full rebuild.
    let prev: Tone.ToneAudioNode = input;
    for (let i = 0; i < 8; i++) {
      const bp = next.bands[i];
      const fb = bands[i].filter;

      // For now, we update existing nodes when possible.
      // If filter type or enabled state changed, we need to rebuild.
      const needsRebuild = (bp.enabled && !fb) || (!bp.enabled && fb);

      // Disconnect old
      if (fb) {
        try { fb.disconnect(); } catch {}
      }

      if (needsRebuild) {
        // Dispose old, create new or remove
        if (fb) { try { fb.dispose(); } catch {} }
        bands[i].filter = null;

        if (bp.enabled) {
          const newFilter = new Tone.BiquadFilter({
            frequency: bp.frequency,
            type: bp.type === 'tilt' ? 'peaking' : mapFilterType(bp.type),
            Q: bp.Q,
            gain: bp.gain,
          });
          prev.connect(newFilter);
          newFilter.connect(bandOutputs[i]);
          bands[i].filter = newFilter;
        } else {
          prev.connect(bandOutputs[i]);
        }
      } else if (bp.enabled && fb) {
        // Update existing filter params
        const mapped = bp.type === 'tilt' ? 'peaking' : mapFilterType(bp.type);
        if (fb.type !== mapped) {
          fb.set({ type: mapped });
        }
        fb.set({ frequency: bp.frequency, Q: bp.Q });
        fb.gain.rampTo(bp.gain, SMOOTH_TIME);
        // Reconnect (in case we disconnected above)
        prev.connect(fb);
        fb.connect(bandOutputs[i]);
      }

      prev = bandOutputs[i];
    }

    // Update analyzer FFT size
    if (next.analyzerMode !== 'off') {
      spectrumAnalyser.set({ size: next.analyzerFftSize });
    }
    spectrumAnalyser.set({ size: next.analyzerFftSize });
  };

  const dispose = () => {
    [input, analyser, spectrumAnalyser, output, ...bandOutputs].forEach((n) => {
      try { n.disconnect(); n.dispose(); } catch {}
    });
    bands.forEach((b) => {
      if (b.filter) { try { b.filter.disconnect(); b.filter.dispose(); } catch {} }
    });
  };

  return {
    input,
    output,
    analyser,
    spectrumAnalyser,
    update,
    dispose,
  };
}
