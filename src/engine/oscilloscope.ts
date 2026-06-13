/**
 * Oscilloscope engine for Euclidean Groove Spielzeug.
 *
 * Two complementary visualizations:
 *   Master Oscilloscope — real AnalyserNode on the summed output.
 *     Provides a live waveform (time-domain) and spectrum (frequency-domain).
 *     Data sourced from audio.ts's masterAnalyser (Tone.Analyser on the master bus).
 *
 *   Per-channel Oscilloscope — step-data driven "rhythm waveform".
 *     Tied to the actual step clock; shows hits as they fire with velocity
 *     mapping. Not raw sample audio, but genuinely live and zero-latency.
 *
 * All scopes are OFF by default. Users must explicitly enable them.
 */

import { getMasterAnalyser, getMasterAnalyserFft } from '../audio';

// ---------------------------------------------------------------------------
// Master analyser — reads real audio data from audio.ts's master bus analyser
// ---------------------------------------------------------------------------

let masterEnabled = false;

/**
 * Enable or disable the master scope data pipeline.
 * When disabled, all get* functions return null.
 */
export function setMasterScopeEnabled(enabled: boolean): void {
  masterEnabled = enabled;
}

/**
 * Get time-domain waveform data for the master output.
 * Reads from the Tone.Analyser on the master bus (audio.ts).
 * Returns Float32Array of amplitude values (-1 to 1) or null if disabled.
 */
export function getMasterWaveform(): Float32Array | null {
  if (!masterEnabled) return null;
  try {
    const analyser = getMasterAnalyser();
    if (!analyser) return null;
    return analyser.getValue() as Float32Array;
  } catch {
    return null;
  }
}

/**
 * Get frequency-domain data for the master output.
 * Uses the dedicated FFT analyser on the master bus.
 * Returns Float32Array of dBFS values (-100 to 0), size 256, or null if disabled.
 */
export function getMasterFrequencyData(): Float32Array | null {
  if (!masterEnabled) return null;
  try {
    const analyser = getMasterAnalyserFft();
    if (!analyser) return null;
    return analyser.getValue() as Float32Array;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Per-channel scope — step-data driven "rhythm waveform"
//
// Each time the step callback fires we record a "hit event" for each enabled
// channel. This is stored as a ring buffer of (time, value) pairs which the
// canvas component reads to paint a scrolling waveform-like visualization.
// ---------------------------------------------------------------------------

const MAX_HISTORY = 256;
type HitEvent = { t: number; v: number }; // time (monotonic counter), value (0–1)

const channelHistory: Record<string, HitEvent[]> = {};

/**
 * Feed a step event into the per-channel scope system.
 * Called from the main step callback via the step scheduler.
 * `trackId` — the track's id.
 * `hit` — 0 (no hit) or >0 (hit value, e.g. velocity × volume).
 * `globalStep` — the current global clock step (acts as a timestamp).
 */
export function feedChannelStep(trackId: string, hit: number, globalStep: number): void {
  const events = channelHistory[trackId] ?? (channelHistory[trackId] = []);
  // Add hit event
  if (hit > 0) {
    events.push({ t: globalStep, v: Math.min(1, hit) });
  }
  // Always add a "0" value to keep the waveform scrolling
  events.push({ t: globalStep + 0.5, v: 0 });

  // Trim
  while (events.length > MAX_HISTORY) {
    events.shift();
  }
}

/**
 * Get the per-channel waveform buffer for rendering.
 * Returns a Float32Array of samples (0–1) representing recent hit activity,
 * or null if the channel is not tracked.
 */
export function getChannelWaveform(trackId: string, desiredLength: number): Float32Array | null {
  const events = channelHistory[trackId];
  if (!events || events.length < 2) return null;

  const buf = new Float32Array(desiredLength);
  if (events.length === 0) return buf;

  const timeRange = events[events.length - 1].t - events[0].t || 1;
  let evIdx = 0;

  for (let i = 0; i < desiredLength; i++) {
    const targetT = events[0].t + (i / desiredLength) * timeRange;
    while (evIdx < events.length - 1 && events[evIdx + 1].t < targetT) {
      evIdx++;
    }
    if (evIdx >= events.length - 1) {
      buf[i] = events[events.length - 1].v;
    } else {
      const e0 = events[evIdx];
      const e1 = events[evIdx + 1];
      const frac = e1.t - e0.t > 0 ? (targetT - e0.t) / (e1.t - e0.t) : 0;
      buf[i] = e0.v + (e1.v - e0.v) * frac;
    }
  }

  return buf;
}

/**
 * Clear all channel history (e.g. when stopping or loading a preset).
 */
export function clearChannelHistory(): void {
  for (const key of Object.keys(channelHistory)) {
    delete channelHistory[key];
  }
  sonagramHistory.length = 0;
}

// ---------------------------------------------------------------------------
// Sonagram (spectrogram) — rolling buffer of FFT magnitude frames
//   - Each frame is frequency magnitudes (0 = low, end = high)
//   - Appended every ~60ms; canvas paints oldest-left → newest-right
// ---------------------------------------------------------------------------

const SONAGRAM_MAX_FRAMES = 256;
const sonagramHistory: Float32Array[] = [];
let sonagramTimer = 0;
const SONAGRAM_INTERVAL_MS = 60;

/**
 * Capture a new sonagram frame from the master analyser.
 * Returns the full history (oldest → newest) for drawing, or null.
 */
export function captureSonagramFrame(): Float32Array[] | null {
  if (!masterEnabled) return null;

  const now = Date.now();
  if (now - sonagramTimer < SONAGRAM_INTERVAL_MS) {
    return sonagramHistory.length > 0 ? sonagramHistory : null;
  }
  sonagramTimer = now;

  try {
    const analyser = getMasterAnalyserFft();
    if (!analyser) return null;

    const buf = analyser.getValue() as Float32Array;

    // Normalize to 0–1
    const frame = new Float32Array(buf.length);
    for (let i = 0; i < buf.length; i++) {
      // buf is likely in dB (-100 to 0), normalize
      frame[i] = Math.max(0, Math.min(1, (buf[i] + 100) / 100));
    }

    sonagramHistory.push(frame);
    while (sonagramHistory.length > SONAGRAM_MAX_FRAMES) {
      sonagramHistory.shift();
    }

    return sonagramHistory;
  } catch {
    return null;
  }
}
