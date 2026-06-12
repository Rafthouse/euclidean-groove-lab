/**
 * Oscilloscope canvas component.
 *
 * Renders either a waveform (time-domain) or spectrum (frequency-domain)
 * display driven by live audio data. Professional studio aesthetic —
 * not gaming, not cyberpunk.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { getMasterWaveform, getMasterFrequencyData, getChannelWaveform, captureSonagramFrame } from '../engine/oscilloscope';

export interface OscilloscopeProps {
  /** Track ID for per-channel scope. Omit or empty for master. */
  trackId?: string;
  /** Display mode. Default 'waveform'. */
  mode?: 'waveform' | 'spectrum' | 'sonagram';
  /** Color for the waveform/stroke. Inherits track color for per-channel. */
  color?: string;
  /** Width. Default fills parent. */
  width?: number;
  /** Height. Default 64 for per-channel, 160 for master. */
  height?: number;
  /** Whether this scope is active (enabled by user). */
  active: boolean;
}

const Oscilloscope: React.FC<OscilloscopeProps> = ({
  trackId,
  mode = 'waveform',
  color = '#88cc88',
  width: propWidth,
  height: propHeight,
  active,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const isMaster = !trackId;

  const width = propWidth;
  const height = propHeight ?? (isMaster ? 160 : 80);

  const draw = useCallback(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    if (mode === 'spectrum' && isMaster) {
      drawSpectrum(ctx, w, h, color);
    } else if (mode === 'sonagram' && isMaster) {
      drawSonagram(ctx, w, h, color);
    } else {
      drawWaveform(ctx, w, h, color, trackId);
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [active, mode, color, trackId, isMaster, width, height]);

  useEffect(() => {
    if (active) {
      rafRef.current = requestAnimationFrame(draw);
    } else {
      cancelAnimationFrame(rafRef.current);
      // Clear canvas when inactive
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [active, draw]);

  // Re-draw on resize
  useEffect(() => {
    const onResize = () => {
      if (active) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(draw);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active, draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="oscilloscope-canvas"
      style={{ width, height }}
    />
  );
};

// ── Waveform renderer ──────────────────────────────────────────────────

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  trackId?: string,
): void {
  if (trackId) {
    // Per-channel: simple pulse bar — one vertical bar that jumps on hit
    drawChannelPulse(ctx, w, h, color, trackId);
    return;
  }

  // Master: real audio waveform
  const data = getMasterWaveform();
  if (!data || data.length < 2) {
    drawGrid(ctx, w, h, color);
    return;
  }

  const mid = h / 2;
  const scale = h * 0.45;

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  drawGrid(ctx, w, h, color);

  for (let i = 0; i < data.length; i++) {
    const x = (i / data.length) * w;
    const y = mid + data[i] * scale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Subtle glow underlay
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = (i / data.length) * w;
    const y = mid + data[i] * scale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Per-channel scope: a simple vertical pulse bar.
 * Shows a thick bar whose height reflects the current hit value,
 * with quick decay between hits — "just a line that pulses".
 */
function drawChannelPulse(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  trackId: string,
): void {
  const data = getChannelWaveform(trackId, Math.min(w, 128));
  if (!data || data.length < 2) {
    drawGrid(ctx, w, h, color);
    return;
  }

  // Find the peak value in the most recent data
  const recentCount = Math.min(8, data.length);
  let peak = 0;
  for (let i = data.length - recentCount; i < data.length; i++) {
    const v = data[i];
    if (v > peak) peak = v;
  }

  // Scale: make it pop even at low velocities
  const scaledPeak = Math.min(1, peak * 2.5);

  // Draw a thick centered bar
  const barWidth = Math.max(4, w * 0.3);
  const barX = (w - barWidth) / 2;
  const barH = Math.max(1, scaledPeak * h * 0.9);
  const barY = h - barH;

  ctx.clearRect(0, 0, w, h);

  // Fill
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.6 + scaledPeak * 0.4;
  ctx.fillRect(barX, barY, barWidth, barH);

  // Glow
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(barX, barY, barWidth, barH);
  ctx.restore();

  // Baseline
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.15;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h - 1);
  ctx.lineTo(w, h - 1);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ── Spectrum renderer (master only) ────────────────────────────────────

function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
): void {
  const data = getMasterFrequencyData();
  if (!data) {
    drawGrid(ctx, w, h, color);
    return;
  }

  const barCount = data.length;
  const barWidth = Math.max(1, w / barCount);

  // Background grid
  drawGrid(ctx, w, h, color);

  for (let i = 0; i < barCount; i++) {
    // data is in dB (-100 to 0), normalize to 0–1
    const db = data[i];
    const normalized = Math.max(0, (db + 100) / 100);
    const barHeight = normalized * h;

    const x = i * barWidth;
    const y = h - barHeight;

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.6 + normalized * 0.4;
    ctx.fillRect(x, y, Math.max(1, barWidth - 0.5), barHeight);
  }
  ctx.globalAlpha = 1;
}

// ── Sonagram renderer (master only) ───────────────────────────────────
// Draws a scrolling spectrogram: horizontal axis = time, vertical = frequency,
// colour intensity = magnitude.

function drawSonagram(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
): void {
  const frames = captureSonagramFrame();
  if (!frames || frames.length < 2) {
    drawGrid(ctx, w, h, color);
    return;
  }

  const frameCount = frames.length;
  const freqBins = frames[0].length;

  // Map each frequency bin to a hue based on its index (low = warm, high = cool)
  // within the track colour's hue family

  for (let fi = 0; fi < frameCount; fi++) {
    const x = (fi / frameCount) * w;
    const nextX = ((fi + 1) / frameCount) * w;
    const colWidth = Math.max(1, nextX - x);

    for (let bi = 0; bi < freqBins; bi++) {
      const mag = frames[fi][bi];
      if (mag < 0.02) continue; // skip near-silent bins

      const y = h - (bi / freqBins) * h;
      const barH = Math.max(1, h / freqBins);

      // Intensity: low magnitues are transparent, high are opaque
      ctx.globalAlpha = 0.15 + mag * 0.85;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, colWidth, barH);
    }
  }

  ctx.globalAlpha = 1;
}


// ── Grid helper ─────────────────────────────────────────────────────────

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.08;
  ctx.lineWidth = 0.5;

  // Horizontal center line
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  // Horizontal thirds
  for (let y = h / 3; y < h; y += h / 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Vertical divisions (quarter notes)
  const divs = 8;
  for (let i = 1; i < divs; i++) {
    const x = (i / divs) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  ctx.restore();
}

export default React.memo(Oscilloscope);
