/**
 * Compressor Visualizer – Canvas-based.
 *
 * Shows:
 *   – Gain Reduction meter (vertical, -30 dB to 0 dB)
 *   – Threshold line
 *   – Compression curve (input vs output, static map)
 *   – Simulated live GR needle/reduction
 *
 * The visualizer is purely cosmetic in V1 — it uses a synthetic
 * envelope follower fed from the param values rather than real
 * audio data. A future version can tap the actual AudioNode.
 */

import { useRef, useEffect } from 'react';
import type { CompressorParams } from '../mixer/fxTypes';

// ── Curves ────────────────────────────────────────────────────────────

/**
 * Compute the output dB for a given input dB, using the standard
 * compressor curve (hard knee for simplicity):
 *
 *   below threshold → 1:1 (no compression)
 *   above threshold → ratio:1
 */
function compressionCurve(
  inputDb: number,
  threshold: number,
  ratio: number,
): number {
  if (inputDb >= threshold) {
    return threshold + (inputDb - threshold) / ratio;
  }
  return inputDb;
}

// ── Component ─────────────────────────────────────────────────────────

interface CompressorVisualizerProps {
  params: CompressorParams;
  isOpen: boolean;
}

const W = 320;
const H = 180;
const PAD = 16;
const GRAPH_W = W - PAD * 2;
const GRAPH_H = H - PAD * 2;
const CURVE_STEPS = 100;

export default function CompressorVisualizer({ params, isOpen }: CompressorVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grRef = useRef<number>(0); // simulated gain reduction

  // Run animation
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;

    const draw = (time: number) => {

      // Simulate gain reduction: oscillate based on params
      const triggerHz = 2 + (1 / (params.attack + params.release + 0.01));
      const envelope = (Math.sin(time * triggerHz * 0.001 * Math.PI * 2) + 1) / 2;
      const drive = Math.max(0, -(params.threshold)) / 60;
      const reductionDb = -(envelope * drive * 24); // 0 to -24 dB-ish
      // Smooth
      grRef.current = grRef.current * 0.85 + reductionDb * 0.15;

      // Clear
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.roundRect(0, 0, W, H, 8);
      ctx.fill();

      drawCurve(ctx, params);
      drawGrMeter(ctx, grRef.current, params);
      drawThreshold(ctx, params);

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [params, isOpen]);

  return (
    <div className="cmp-visualizer">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="cmp-visualizer-canvas"
        aria-label="Compressor visualizer — gain reduction and compression curve"
      />
      <div className="cmp-visualizer-label">GAIN REDUCTION</div>
    </div>
  );
}

// ── Drawing helpers ────────────────────────────────────────────────────

function drawCurve(
  ctx: CanvasRenderingContext2D,
  params: CompressorParams,
) {
  const { threshold, ratio } = params;
  const x0 = PAD;
  const y0 = PAD;
  const w = GRAPH_W;
  const h = GRAPH_H;
  const dbMin = -60;
  const dbMax = 0;

  function xOfDb(db: number): number {
    return x0 + ((db - dbMin) / (dbMax - dbMin)) * w;
  }
  function yOfOutput(db: number): number {
    return y0 + h - ((db - dbMin) / (dbMax - dbMin)) * h;
  }

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let db = -60; db <= 0; db += 10) {
    const y = yOfOutput(db);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + w, y);
    ctx.stroke();
  }

  // Input/Output curve (the "knee" bend)
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= CURVE_STEPS; i++) {
    const inputDb = dbMin + (i / CURVE_STEPS) * (dbMax - dbMin);
    const outputDb = compressionCurve(inputDb, threshold, ratio);
    const x = xOfDb(inputDb);
    const y = yOfOutput(outputDb);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Straight 1:1 reference
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.moveTo(xOfDb(dbMin), yOfOutput(dbMin));
  ctx.lineTo(xOfDb(dbMax), yOfOutput(dbMax));
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawThreshold(
  ctx: CanvasRenderingContext2D,
  params: CompressorParams,
) {
  const { threshold } = params;
  const dbMin = -60;
  const dbMax = 0;
  const x0 = PAD;
  const w = GRAPH_W;
  const y0 = PAD;
  const h = GRAPH_H;

  const y = y0 + h - ((threshold - dbMin) / (dbMax - dbMin)) * h;

  ctx.strokeStyle = 'rgba(255, 200, 0, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x0 + w, y);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 200, 0, 0.8)';
  ctx.font = '9px monospace';
  ctx.fillText(`${threshold.toFixed(1)} dB`, x0 + w - 40, y - 4);
}

function drawGrMeter(
  ctx: CanvasRenderingContext2D,
  grDb: number,
  _params: CompressorParams,
) {
  const meterW = 16;
  const meterH = GRAPH_H;
  const mx = W - PAD - meterW - 4;
  const my = PAD;

  // Meter background
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(mx, my, meterW, meterH);

  // GR fill (from bottom up)
  const grNorm = Math.min(1, Math.max(0, -grDb / 30));
  const fillH = grNorm * meterH;
  const color = grNorm > 0.7 ? '#ff4444' : grNorm > 0.4 ? '#ffaa00' : '#44dd44';
  ctx.fillStyle = color;
  ctx.fillRect(mx, my + meterH - fillH, meterW, fillH);

  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx, my, meterW, meterH);

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('0', mx + meterW / 2, my - 2);
  ctx.fillText('-15', mx + meterW / 2, my + meterH / 2 + 3);
  ctx.fillText('-30', mx + meterW / 2, my + meterH + 10);

  // Value
  ctx.fillStyle = color;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${grDb.toFixed(1)} dB`, mx - 4, my + meterH / 2 + 4);
}
