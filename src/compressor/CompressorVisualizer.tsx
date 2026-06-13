/**
 * Compressor Visualizer — Canvas-based.
 *
 * Renders:
 *   - Gain Reduction meter (vertical, 0 to -30 dB)
 *   - Threshold line on curve
 *   - Input/Output compression curve
 *   - GR value readout
 *
 * Uses simulated GR envelope for display. Real audio tap (post-compressor
 * analyser) can replace the simulation in a future revision.
 */

import { useRef, useEffect, useCallback } from 'react';
import type { CompressorParams } from '../mixer/fxTypes';

// ── Static curve ──────────────────────────────────────────────────────

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

interface Props {
  params: CompressorParams;
  /** Live GR from engine analyser (dB, ≤ 0). */
  liveGR?: number;
  isOpen: boolean;
}

const W = 400;
const H = 240;
const PAD = 20;
const GX = PAD;
const GY = PAD;
const GW = 240;
const GH = H - PAD * 2;
const MX = GX + GW + 16;
const MY = GY;
const MW = 24;
const MH = GH;
const CURVE_STEPS = 200;

export default function CompressorVisualizer({ params, liveGR, isOpen }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grRef = useRef(0);
  const simTimeRef = useRef(0);

  const draw = useCallback((ctx: CanvasRenderingContext2D, now: number) => {
    const { threshold, ratio } = params;

    // Simulated GR envelope when no liveGR
    simTimeRef.current += 0.016;
    const simDrive = Math.max(0, -threshold) / 60;
    const simEnvelope = (Math.sin(simTimeRef.current * 4 * Math.PI) + 1) / 2;
    const targetGR = liveGR ?? -(simEnvelope * simDrive * 24);
    grRef.current = grRef.current * 0.88 + targetGR * 0.12;
    const gr = grRef.current;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 8);
    ctx.fill();

    // ── Compression Curve ────────────────────────────────────────────
    const dbMin = -60;
    const dbMax = 0;
    function xOfDb(db: number) { return GX + ((db - dbMin) / (dbMax - dbMin)) * GW; }
    function yOfOut(db: number) { return GY + GH - ((db - dbMin) / (dbMax - dbMin)) * GH; }

    // Grid (every 10 dB)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let db = -60; db <= 0; db += 10) {
      const y = yOfOut(db);
      ctx.beginPath();
      ctx.moveTo(GX, y);
      ctx.lineTo(GX + GW, y);
      ctx.stroke();
      // Labels
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '8px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${db}`, GX - 4, y + 3);
    }

    // 1:1 reference (dashed)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.moveTo(xOfDb(dbMin), yOfOut(dbMin));
    ctx.lineTo(xOfDb(dbMax), yOfOut(dbMax));
    ctx.stroke();
    ctx.setLineDash([]);

    // Compression curve
    ctx.beginPath();
    ctx.strokeStyle = '#66ccff';
    ctx.lineWidth = 2;
    for (let i = 0; i <= CURVE_STEPS; i++) {
      const inDb = dbMin + (i / CURVE_STEPS) * (dbMax - dbMin);
      const outDb = compressionCurve(inDb, threshold, ratio);
      const x = xOfDb(inDb);
      const y = yOfOut(outDb);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Threshold line (yellow dashed)
    const ty = yOfOut(threshold);
    ctx.strokeStyle = 'rgba(255,200,0,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(GX, ty);
    ctx.lineTo(GX + GW, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,200,0,0.7)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`T ${threshold.toFixed(1)} dB`, GX + GW - 70, ty - 4);

    // ── GR Meter ─────────────────────────────────────────────────────
    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(MX, MY, MW, MH);

    // Fill from bottom
    const grNorm = clamp(-gr / 30, 0, 1);
    const fillH = grNorm * MH;
    const color = grNorm > 0.7 ? '#ff4444' : grNorm > 0.4 ? '#ffaa00' : '#44dd44';
    ctx.fillStyle = color;
    ctx.fillRect(MX, MY + MH - fillH, MW, fillH);

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(MX, MY, MW, MH);

    // Meter labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('0', MX + MW / 2, MY - 2);
    ctx.fillText('-15', MX + MW / 2, MY + MH / 2 + 3);
    ctx.fillText('-30', MX + MW / 2, MY + MH + 10);

    // GR value readout
    ctx.fillStyle = color;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${gr.toFixed(1)} dB`, MX - 6, MY + MH / 2 + 5);

    // Ratio / threshold info
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${ratio.toFixed(1)}:1`, GX + 4, GY + 12);
  }, [params, liveGR]);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const loop = (t: number) => {
      draw(ctx, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw, isOpen]);

  return (
    <div className="cmp-visualizer">
      <canvas ref={canvasRef} width={W} height={H} className="cmp-vis-canvas" aria-label="Compressor visualizer" />
      <div className="cmp-vis-label">GAIN REDUCTION</div>
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
