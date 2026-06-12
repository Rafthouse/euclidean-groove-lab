/**
 * Oscilloscope canvas component.
 *
 * Renders either a waveform (time-domain) or spectrum (frequency-domain)
 * display driven by live audio data. Professional studio aesthetic —
 * not gaming, not cyberpunk.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { getMasterWaveform, getMasterFrequencyData, getChannelWaveform } from '../engine/oscilloscope';

export interface OscilloscopeProps {
  /** Track ID for per-channel scope. Omit or empty for master. */
  trackId?: string;
  /** Display mode. Default 'waveform'. */
  mode?: 'waveform' | 'spectrum';
  /** Color for the waveform/stroke. Inherits track color for per-channel. */
  color?: string;
  /** Width. Default fills parent. */
  width?: number;
  /** Height. Default 80 for per-channel, 160 for master. */
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
  let data: Float32Array | null;

  if (trackId) {
    // Per-channel: step-data driven waveform
    data = getChannelWaveform(trackId, w);
  } else {
    // Master: real audio waveform
    data = getMasterWaveform();
  }

  if (!data || data.length < 2) {
    drawGrid(ctx, w, h, color);
    return;
  }

  const mid = h / 2;
  const scale = h * 0.4;

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Grid
  drawGrid(ctx, w, h, color);

  for (let i = 0; i < data.length; i++) {
    const x = (i / data.length) * w;
    let y: number;

    if (trackId) {
      // Per-channel: 0–1 mapped bottom-to-top
      y = h - data[i] * h * 0.85 - (h * 0.075);
    } else {
      // Master: -1 to 1 centered
      y = mid + data[i] * scale;
    }

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();

  // Subtle glow
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.lineWidth = 0.5;
  for (let i = 0; i < data.length; i++) {
    const x = (i / data.length) * w;
    let y: number;
    if (trackId) {
      y = h - data[i] * h * 0.85 - (h * 0.075);
    } else {
      y = mid + data[i] * scale;
    }
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
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
