/**
 * Oscilloscope canvas component.
 *
 * Renders a real audio waveform (time-domain) or spectrum (frequency-domain)
 * driven by live AnalyserNode data from the master bus.
 *
 * Professional studio aesthetic — thin line, subtle glow, centered zero line.
 * No single vertical bar, no blocky bar graph for waveform mode.
 *
 * Debug overlay (temporary): shows RMS, peak, and sample count when
 * active, to help diagnose data pipeline issues.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { getMasterWaveform, getMasterFrequencyData, getChannelWaveform, captureSonagramFrame } from '../engine/oscilloscope';

export interface OscilloscopeProps {
  trackId?: string;
  mode?: 'waveform' | 'spectrum' | 'sonagram';
  color?: string;
  width?: number;
  height?: number;
  active: boolean;
}

interface DebugInfo {
  rms: number;
  peak: number;
  sampleCount: number;
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
  const debugRef = useRef<DebugInfo>({ rms: 0, peak: 0, sampleCount: 0 });
  const [debug, setDebug] = useState<DebugInfo>({ rms: 0, peak: 0, sampleCount: 0 });
  const isMaster = !trackId;

  const width = propWidth;
  const height = propHeight ?? (isMaster ? 160 : 80);

  // Throttle React state updates to ~4 fps (don't spam re-renders)
  const debugTimerRef = useRef(0);

  const draw = useCallback(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Always draw the grid
    drawGrid(ctx, w, h, color);

    if (!isMaster && mode === 'waveform') {
      drawChannelPulse(ctx, w, h, color, trackId!);
    } else if (mode === 'spectrum') {
      drawSpectrum(ctx, w, h, color, debugRef);
    } else if (mode === 'sonagram') {
      drawSonagram(ctx, w, h, color);
    } else {
      drawWaveform(ctx, w, h, color, debugRef);
    }

    // Update debug React state every ~250ms
    const now = Date.now();
    if (now - debugTimerRef.current > 250) {
      debugTimerRef.current = now;
      setDebug({ ...debugRef.current });
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [active, mode, color, trackId, isMaster, width, height]);

  useEffect(() => {
    if (active) {
      rafRef.current = requestAnimationFrame(draw);
    } else {
      cancelAnimationFrame(rafRef.current);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, draw]);

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

  // Also resize on container size change
  useEffect(() => {
    const container = canvasRef.current?.parentElement;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      if (active) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(draw);
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [active, draw]);

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="oscilloscope-canvas"
        style={{ width, height, display: 'block' }}
      />
      {/* Debug overlay — shows RMS/Peak/Samples */}
      {active && (
        <div style={{
          position: 'absolute',
          top: 2,
          right: 4,
          fontSize: 9,
          fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.35)',
          textAlign: 'right',
          lineHeight: 1.3,
          pointerEvents: 'none',
        }}>
          {debug.rms.toFixed(1)} dB
          {' '}{debug.peak.toFixed(1)} dB
          {' '}{debug.sampleCount}s
        </div>
      )}
    </div>
  );
};

// ── Waveform renderer ──────────────────────────────────────────────────
// Professional audio engineer aesthetic: thin line, centered around zero,
// positive and negative amplitude clearly visible.

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  debug: { current: DebugInfo },
): void {
  const data = getMasterWaveform();

  if (!data || data.length < 2) {
    drawGrid(ctx, w, h, color);
    // Show "NO DATA" when no signal
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.15;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('awaiting signal', w / 2, h / 2 + 4);
    ctx.restore();
    return;
  }

  const mid = h / 2;
  const scale = h * 0.42; // slightly less than full height for headroom

  // Compute debug info
  let rms = 0;
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    rms += v * v;
    if (Math.abs(v) > peak) peak = Math.abs(v);
  }
  rms = Math.sqrt(rms / data.length);
  debug.current.rms = rms <= 0.0001 ? -90 : 20 * Math.log10(rms);
  debug.current.peak = peak <= 0.0001 ? -90 : 20 * Math.log10(peak);
  debug.current.sampleCount = data.length;

  // ── Main waveform line ─────────────────────────────────────────────
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (let i = 0; i < data.length; i++) {
    const x = (i / (data.length - 1)) * w;
    const y = mid + data[i] * scale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // ── Subtle glow underlay ──────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = (i / (data.length - 1)) * w;
    const y = mid + data[i] * scale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

// ── Per-channel pulse bar ──────────────────────────────────────────────
// Simple vertical bar that jumps on hit with quick decay.

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

  const recentCount = Math.min(8, data.length);
  let peak = 0;
  for (let i = data.length - recentCount; i < data.length; i++) {
    const v = data[i];
    if (v > peak) peak = v;
  }

  const scaledPeak = Math.min(1, peak * 2.5);
  const barWidth = Math.max(4, w * 0.3);
  const barX = (w - barWidth) / 2;
  const barH = Math.max(1, scaledPeak * h * 0.9);
  const barY = h - barH;

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
  ctx.globalAlpha = 1;
}

// ── Spectrum renderer (master only) ────────────────────────────────────

function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  debug: { current: DebugInfo },
): void {
  const data = getMasterFrequencyData();
  if (!data) {
    drawGrid(ctx, w, h, color);
    return;
  }

  debug.current.sampleCount = data.length;

  const barCount = data.length;
  const barWidth = Math.max(1, w / barCount);

  for (let i = 0; i < barCount; i++) {
    const db = data[i];
    // data is in dB (approximately -100 to 0), normalize
    const normalized = Math.max(0, Math.min(1, (db + 100) / 100));
    const barHeight = Math.max(0, normalized * h);

    const x = i * barWidth;
    const y = h - barHeight;

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.5 + normalized * 0.5;
    ctx.fillRect(x, y, Math.max(1, barWidth - 0.5), barHeight);
  }
  ctx.globalAlpha = 1;
}

// ── Sonagram renderer (master only) ───────────────────────────────────

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

  // Find max magnitude across all frames for dynamic range
  let maxMag = 0;
  for (const frame of frames) {
    for (const mag of frame) {
      if (mag > maxMag) maxMag = mag;
    }
  }
  if (maxMag === 0) maxMag = 1;

  for (let fi = 0; fi < frameCount; fi++) {
    const x = (fi / frameCount) * w;
    const nextX = ((fi + 1) / frameCount) * w;
    const colWidth = Math.max(1, nextX - x);

    for (let bi = 0; bi < freqBins; bi++) {
      const mag = frames[fi][bi] / maxMag; // normalize to 0-1
      if (mag < 0.03) continue;

      const y = h - (bi / freqBins) * h;
      const barH = Math.max(1, h / freqBins);

      ctx.globalAlpha = 0.1 + mag * 0.9;
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

  // Vertical divisions
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
