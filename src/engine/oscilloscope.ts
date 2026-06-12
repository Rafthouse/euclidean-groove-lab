/**
 * Oscilloscope engine for Euclidean Groove Spielzeug.
 *
 * Two complementary visualizations:
 *   Master Oscilloscope — real AnalyserNode on the summed output.
 *     Provides a live waveform (time-domain) and spectrum (frequency-domain).
 *
 *   Per-channel Oscilloscope — step-data driven "rhythm waveform".
 *     Tied to the actual step clock; shows hits as they fire with velocity
 *     mapping. Not raw sample audio, but genuinely live and zero-latency.
 *
 * All scopes are OFF by default. Users must explicitly enable them.
 */

import { Tone } from './toneShim';

// ---------------------------------------------------------------------------
// Master analyser — real Audio AnalyserNode on master output
// ---------------------------------------------------------------------------

let masterAnalyser: AnalyserNode | null = null;
let masterEnabled = false;

/** Get the underlying AudioContext used by Tone. */
function getAudioContext(): AudioContext | null {
  try {
    return (Tone.getContext() as any)._context as AudioContext;
  } catch {
    return null;
  }
}

/**
 * Initialise or tear down the master AnalyserNode.
 *
 * Architecture:
 *   Tone.Destination.output (Gain)
 *     → masterGain (our GainNode, always present when enabled)
 *     → masterAnalyser (AnalyserNode, fftSize 2048)
 *     → AudioDestinationNode (speakers)
 *
 * When disabled: bypass the analyser and connect output directly to destination.
 */
export function setMasterScopeEnabled(enabled: boolean): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const dest = Tone.getDestination();
  // @ts-ignore — .output is a Tone.Gain, which wraps an AudioNode
  const toneOutput: AudioNode | undefined = (dest as any).output?._internalAudioNode ?? (dest as any).output?._gain;
  if (!toneOutput && !masterAnalyser) {
    // first time — need to find the output node differently
    // Fallback: use the AudioContext destination directly
    masterEnabled = enabled;
    if (enabled) {
      setupMasterFromContext(ctx);
    } else {
      teardownMaster();
    }
    return;
  }

  masterEnabled = enabled;
  if (enabled) {
    if (masterAnalyser) return; // already set up
    setupMasterAnalyser(ctx, toneOutput!);
  } else {
    teardownMaster();
  }
}

function setupMasterFromContext(ctx: AudioContext): void {
  // Find Tone's output by exploring the destination chain
  try {
    const dest = Tone.getDestination() as any;
    // Tone.Destination is a ToneAudioNode with .input (Volume) and .output (Gain)
    // We need the raw AudioNode that connects to ctx.destination
    const volNode = dest.input?._internalAudioNode ?? dest.input?._volume ?? dest.input?.output;
    const gainNode = dest.output?._internalAudioNode ?? dest.output?._gain;
    const rawOutput = gainNode || volNode;

    if (rawOutput) {
      setupMasterAnalyser(ctx, rawOutput);
    } else {
      // Last resort — chain between the volume and the destination
      const toneCtx = ctx;
      const analyser = toneCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      masterAnalyser = analyser;

      // We can't easily rewire Tone's internal chain at runtime without
      // knowing the exact internal node. Use a workaround: connect analyser
      // to destination in parallel (doesn't affect main signal path).
      // The analyser reads the output without modifying it.
      try {
        const gainOutput = dest.output?._internalAudioNode ?? dest.output?._gain;
        if (gainOutput) {
          gainOutput.connect(analyser);
        }
      } catch {
        // If that fails, connect the fallback analyser to destination
        analyser.connect(toneCtx.destination);
      }
    }
  } catch {
    // Ultimate fallback — create a parallel analyser on the destination
    const toneCtx = ctx;
    const analyser = toneCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    masterAnalyser = analyser;
    try {
      toneCtx.destination.connect(analyser);
    } catch {
      // destination might not allow connections
    }
  }
}

function setupMasterAnalyser(ctx: AudioContext, outputNode: AudioNode): void {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;
  masterAnalyser = analyser;

  try {
    // Connect in parallel — reads signal without affecting main path
    outputNode.connect(analyser);
  } catch {
    // Fallback
    try {
      ctx.destination.connect(analyser);
    } catch {
      // Ignore
    }
  }
}

function teardownMaster(): void {
  if (masterAnalyser) {
    try {
      masterAnalyser.disconnect();
    } catch { /* ignore */ }
    masterAnalyser = null;
  }
  masterEnabled = false;
}

/**
 * Get time-domain waveform data for the master output.
 * Returns Float32Array of length fftSize (2048), or null if disabled.
 */
export function getMasterWaveform(): Float32Array | null {
  if (!masterAnalyser || !masterEnabled) return null;
  const buf = new Float32Array(masterAnalyser.fftSize);
  masterAnalyser.getFloatTimeDomainData(buf);
  return buf;
}

/**
 * Get frequency-domain data for the master output.
 * Returns Float32Array of length fftSize/2 (1024), or null if disabled.
 */
export function getMasterFrequencyData(): Float32Array | null {
  if (!masterAnalyser || !masterEnabled) return null;
  const buf = new Float32Array(masterAnalyser.frequencyBinCount);
  masterAnalyser.getFloatFrequencyData(buf);
  return buf;
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
 *
 * The number of samples equals the minimum of `desiredLength` and available history.
 */
export function getChannelWaveform(trackId: string, desiredLength: number): Float32Array | null {
  const events = channelHistory[trackId];
  if (!events || events.length < 2) return null;

  // Interpolate events into a continuous buffer
  const buf = new Float32Array(desiredLength);
  if (events.length === 0) return buf;

  const timeRange = events[events.length - 1].t - events[0].t || 1;
  let evIdx = 0;

  for (let i = 0; i < desiredLength; i++) {
    const targetT = events[0].t + (i / desiredLength) * timeRange;
    // Find the two surrounding events
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

  // Also clear sonagram history
  sonagramHistory.length = 0;
}

// ---------------------------------------------------------------------------
// Sonagram (spectrogram) — rolling buffer of FFT magnitude frames
//   - Each frame is a slice of frequency magnitudes (0 = low, end = high)
//   - Newest frame appended on request; canvas paints oldest-left → newest-right
//   - Max frames = CANVAS_WIDTH (256) so each column = 1px
// ---------------------------------------------------------------------------

const SONAGRAM_MAX_FRAMES = 256;
const sonagramHistory: Float32Array[] = [];
let sonagramTimer = 0;
const SONAGRAM_INTERVAL_MS = 60; // ~16 fps refresh

/**
 * Capture a new sonagram frame from the master analyser and store it.
 * Returns the full history (oldest → newest) for drawing, or null if unavailable.
 * Frame magnitudes are 0–1 normalised.
 */
export function captureSonagramFrame(): Float32Array[] | null {
  if (!masterAnalyser || !masterEnabled) return null;

  const now = Date.now();
  if (now - sonagramTimer < SONAGRAM_INTERVAL_MS) {
    return sonagramHistory.length > 0 ? sonagramHistory : null;
  }
  sonagramTimer = now;

  // Get frequency magnitude data (linear scale for sonagram)
  const buf = new Uint8Array(masterAnalyser.frequencyBinCount);
  masterAnalyser.getByteFrequencyData(buf);

  // Convert to 0-1 float and store
  const frame = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    frame[i] = buf[i] / 255;
  }

  sonagramHistory.push(frame);

  // Trim to max frames
  while (sonagramHistory.length > SONAGRAM_MAX_FRAMES) {
    sonagramHistory.shift();
  }

  return sonagramHistory;
}


