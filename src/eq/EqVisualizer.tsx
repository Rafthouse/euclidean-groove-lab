/**
 * SHCHUR EQ Visualizer — Canvas-based frequency graph editor.
 *
 * Renders:
 *   - Frequency response grid (log scale: 20 Hz - 20 kHz, dB: -24 to +24)
 *   - Individual band curves with unique colors
 *   - Combined response curve
 *   - Spectrum analyzer overlay (when enabled)
 *   - Draggable nodes for direct frequency/gain/Q editing
 *   - Double-click to reset gain
 *   - Mouse wheel + Shift for fine frequency adjustment
 *
 * Interaction:
 *   - Drag node up/down → adjust Gain
 *   - Drag node left/right → adjust Frequency
 *   - Alt+drag → adjust Q (width)
 *   - Double-click → reset Gain to 0 dB
 *   - Scroll → adjust frequency of nearest band
 *   - Shift+Scroll → fine frequency adjustment
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import type { Eq2Params, EqBandParams, EqBandType } from '../mixer/fxTypes';
import { BAND_COLORS } from '../mixer/fxTypes';

// ── Constants ─────────────────────────────────────────────────────────

const W = 780;
const H = 300;
const PAD_L = 50;
const PAD_R = 20;
const PAD_T = 20;
const PAD_B = 30;
const GW = W - PAD_L - PAD_R;
const GH = H - PAD_T - PAD_B;

const FREQ_MIN = 20;
const FREQ_MAX = 20000;
const DB_MIN = -24;
const DB_MAX = 24;

const DRAG_THRESHOLD = 4; // px tolerance
const FREQ_NODE_MIN_DIST = 2; // px minimum between nodes

// ── Coordinate helpers ────────────────────────────────────────────────

function freqToX(freq: number): number {
  const norm = (Math.log2(freq) - Math.log2(FREQ_MIN)) / (Math.log2(FREQ_MAX) - Math.log2(FREQ_MIN));
  return PAD_L + norm * GW;
}

function xToFreq(x: number): number {
  const norm = (x - PAD_L) / GW;
  return Math.round(Math.pow(2, Math.log2(FREQ_MIN) + norm * (Math.log2(FREQ_MAX) - Math.log2(FREQ_MIN))));
}

function dBToY(db: number): number {
  const norm = (db - DB_MIN) / (DB_MAX - DB_MIN);
  return PAD_T + GH - norm * GH;
}

function yToDB(y: number): number {
  const norm = (y - PAD_T) / GH;
  return DB_MAX - norm * (DB_MAX - DB_MIN);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── Band response computation ─────────────────────────────────────────

/** Compute the dB response of a single biquad filter at a given frequency. */
function bandResponse(bp: EqBandParams, freq: number): number {
  if (!bp.enabled) return 0;

  const f = freq / bp.frequency;  // normalized frequency
  const Q = bp.Q;
  const g = dbToLinear(bp.gain);

  // Simplified biquad magnitude response
  // For peaking/bell: H(s) = (s² + s*(A/Q) + 1) / (s² + s/(A*Q) + 1)
  // where A = 10^(gain/40)
  // For shelves/cuts we use approximations

  switch (bp.type) {
    case 'bell': {
      const A = Math.pow(10, bp.gain / 40);
      const num = f * f - 1;
      const den = f * f - 1;
      const numImag = f * A / Q;
      const denImag = f / (A * Q);
      const magSq = (num * num + numImag * numImag) / (den * den + denImag * denImag);
      return linearToDb(Math.sqrt(magSq));
    }
    case 'lowShelf': {
      const A = Math.pow(10, bp.gain / 40);
      const sqrtA = Math.sqrt(A);
      const numR = f * f - 1;
      const denR = f * f - 1;
      const numImag = f * sqrtA / Q;
      const denImag = f / (sqrtA * Q);
      const magSq = (numR * numR + numImag * numImag) / (denR * denR + denImag * denImag);
      return linearToDb(Math.sqrt(magSq));
    }
    case 'highShelf': {
      const A = Math.pow(10, bp.gain / 40);
      const sqrtA = Math.sqrt(A);
      const numR = f * f - 1;
      const denR = f * f - 1;
      const numImag = f * Q * sqrtA;
      const denImag = f * Q / sqrtA;
      const magSq = (numR * numR + numImag * numImag) / (denR * denR + denImag * denImag);
      return linearToDb(Math.sqrt(magSq));
    }
    case 'lowCut': {
      // 2nd order HPF
      const magSq = (f * f * f * f) / ((f * f - 1) * (f * f - 1) + (f / Q) * (f / Q));
      return linearToDb(Math.sqrt(magSq));
    }
    case 'highCut': {
      // 2nd order LPF
      const magSq = 1 / ((f * f - 1) * (f * f - 1) + (f / Q) * (f / Q));
      return linearToDb(Math.sqrt(magSq));
    }
    case 'notch': {
      const magSq = ((f * f - 1) * (f * f - 1)) / ((f * f - 1) * (f * f - 1) + (f / Q) * (f / Q));
      return linearToDb(Math.sqrt(magSq));
    }
    case 'bandPass': {
      const magSq = ((f / Q) * (f / Q)) / ((f * f - 1) * (f * f - 1) + (f / Q) * (f / Q));
      return linearToDb(Math.sqrt(magSq));
    }
    case 'tilt': {
      // Approximate tilt as a shelf that crosses 0 at freq
      const A = Math.pow(10, bp.gain / 40);
      const tilt = (Math.log2(f) + 1) / 8;
      return bp.gain * (tilt * 2 - 1);
    }
    default:
      return 0;
  }
}

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

function linearToDb(linear: number): number {
  if (linear <= 0) return -60;
  return 20 * Math.log10(linear);
}

/** Compute combined frequency response across all bands. */
function combinedResponse(bands: EqBandParams[], freq: number): number {
  let totalDb = 0;
  for (const bp of bands) {
    totalDb += bandResponse(bp, freq);
  }
  return totalDb;
}

// ── Grid labels ───────────────────────────────────────────────────────

const FREQ_LABELS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const DB_LABELS = [-24, -18, -12, -6, 0, 6, 12, 18, 24];

// ── Component ─────────────────────────────────────────────────────────

interface Props {
  params: Eq2Params;
  onChange: (p: Eq2Params) => void;
  /** Live spectrum data from analyser (normalized 0-1). */
  spectrumData?: Float32Array;
  isOpen: boolean;
}

export default function EqVisualizer({ params, onChange, spectrumData, isOpen }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragIdx, setDragIdx] = useState(-1);
  const dragRef = useRef<{ idx: number; startX: number; startY: number; origFreq: number; origGain: number; origQ: number; didDrag: boolean } | null>(null);

  // ── Drawing ────────────────────────────────────────────────────────

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const bands = params.bands;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 8);
    ctx.fill();

    // ── Grid ─────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (const db of DB_LABELS) {
      const y = dBToY(db);
      ctx.beginPath();
      ctx.moveTo(PAD_L, y);
      ctx.lineTo(PAD_L + GW, y);
      ctx.stroke();

      // dB labels
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${db}`, PAD_L - 6, y + 3);
    }

    for (const freq of FREQ_LABELS) {
      const x = freqToX(freq);
      ctx.beginPath();
      ctx.moveTo(x, PAD_T);
      ctx.lineTo(x, PAD_T + GH);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
      ctx.fillText(label, x, PAD_T + GH + 16);
    }

    // ── Combined response ────────────────────────────────────────────
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    const steps = GW;
    for (let i = 0; i <= steps; i++) {
      const freq = xToFreq(PAD_L + i);
      const db = combinedResponse(bands, freq);
      const x = PAD_L + i;
      const y = dBToY(clamp(db, DB_MIN - 6, DB_MAX + 6));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // ── Individual band curves ───────────────────────────────────────
    for (let bi = 0; bi < bands.length; bi++) {
      const bp = bands[bi];
      if (!bp.enabled) continue;

      ctx.beginPath();
      ctx.strokeStyle = BAND_COLORS[bi] + '80'; // 50% alpha
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= steps; i++) {
        const freq = xToFreq(PAD_L + i);
        const db = bandResponse(bp, freq);
        const x = PAD_L + i;
        const y = dBToY(clamp(combinedResponse(bands, freq) - (bandResponse(bp, freq) || 0) + db, DB_MIN - 6, DB_MAX + 6));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // ── Spectrum analyzer overlay ────────────────────────────────────
    if (params.analyzerMode !== 'off' && spectrumData && spectrumData.length > 0) {
      const specLen = spectrumData.length;
      ctx.fillStyle = 'rgba(68, 136, 255, 0.15)';
      ctx.beginPath();
      ctx.moveTo(PAD_L, PAD_T + GH);
      for (let i = 0; i < specLen; i++) {
        const x = PAD_L + (i / specLen) * GW;
        const val = (spectrumData[i] + 100) / 100; // normalize from dB (-100..0) to 0..1
        const y = PAD_T + GH - clamp(val, 0, 1) * GH;
        if (i === 0) ctx.lineTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(PAD_L + GW, PAD_T + GH);
      ctx.closePath();
      ctx.fill();
    }

    // ── Draggable nodes ──────────────────────────────────────────────
    for (let bi = 0; bi < bands.length; bi++) {
      const bp = bands[bi];
      if (!bp.enabled) continue;

      const x = freqToX(bp.frequency);
      const y = dBToY(clamp(bp.gain, DB_MIN, DB_MAX));
      const isDrag = bi === dragIdx;

      // Connection line
      ctx.strokeStyle = BAND_COLORS[bi] + '40';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, PAD_T);
      ctx.lineTo(x, PAD_T + GH);
      ctx.stroke();

      // Node dot
      ctx.beginPath();
      ctx.arc(x, y, isDrag ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = BAND_COLORS[bi];
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = isDrag ? 2 : 1;
      ctx.stroke();

      // Band number
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${bi + 1}`, x, y - 12);
    }
  }, [params, dragIdx, spectrumData]);

  // ── Animation loop ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const loop = () => {
      draw(ctx);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw, isOpen]);

  // ── Mouse handlers ─────────────────────────────────────────────────

  const getBandAt = (clientX: number, clientY: number): number => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return -1;
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    let closest = -1;
    let closestDist = Infinity;
    for (let bi = 0; bi < params.bands.length; bi++) {
      if (!params.bands[bi].enabled) continue;
      const bx = freqToX(params.bands[bi].frequency);
      const by = dBToY(clamp(params.bands[bi].gain, DB_MIN, DB_MAX));
      const dist = Math.sqrt((mx - bx) ** 2 + (my - by) ** 2);
      if (dist < closestDist) {
        closestDist = dist;
        closest = bi;
      }
    }
    return closestDist < 20 ? closest : -1;
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const idx = getBandAt(e.clientX, e.clientY);
    if (idx >= 0) {
      const bp = params.bands[idx];
      dragRef.current = {
        idx,
        startX: e.clientX,
        startY: e.clientY,
        origFreq: bp.frequency,
        origGain: bp.gain,
        origQ: bp.Q,
        didDrag: false,
      };
      setDragIdx(idx);
    }
  }, [params.bands]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
      d.didDrag = true;
    }
    if (!d.didDrag) return;

    // Alt = Q adjustment
    if (e.altKey) {
      const qFactor = 1 + dy / 50;
      const newQ = clamp(d.origQ * qFactor, 0.1, 20);
      const bands = params.bands.map((b, i) =>
        i === d.idx ? { ...b, Q: newQ } : b
      );
      onChange({ ...params, bands });
    } else {
      // Frequency from horizontal drag (log scale)
      const freqFactor = Math.pow(2, dx / 200);
      const newFreq = clamp(Math.round(d.origFreq * freqFactor), FREQ_MIN, FREQ_MAX);

      // Gain from vertical drag
      const gainDelta = -dy / 3;
      const newGain = clamp(Math.round((d.origGain + gainDelta) * 10) / 10, DB_MIN, DB_MAX);

      const bands = params.bands.map((b, i) =>
        i === d.idx ? { ...b, frequency: newFreq, gain: newGain } : b
      );
      onChange({ ...params, bands });
    }
  }, [params, onChange]);

  const handleMouseUp = useCallback(() => {
    const d = dragRef.current;
    if (d && !d.didDrag) {
      // Click without drag — could select band
    }
    dragRef.current = null;
    setDragIdx(-1);
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const idx = getBandAt(e.clientX, e.clientY);
    if (idx >= 0) {
      const bands = params.bands.map((b, i) =>
        i === idx ? { ...b, gain: 0 } : b
      );
      onChange({ ...params, bands });
    }
  }, [params, onChange]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Find nearest band
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const freqAtMouse = xToFreq(mx);

    let closest = -1;
    let closestDist = Infinity;
    for (let bi = 0; bi < params.bands.length; bi++) {
      if (!params.bands[bi].enabled) continue;
      const dist = Math.abs(params.bands[bi].frequency - freqAtMouse);
      if (dist < closestDist) {
        closestDist = dist;
        closest = bi;
      }
    }

    if (closest < 0) return;

    const delta = e.deltaY > 0 ? -1 : 1;
    const fine = e.shiftKey;
    const step = fine ? 1 : 10;
    const newFreq = clamp(params.bands[closest].frequency + delta * step, FREQ_MIN, FREQ_MAX);

    const bands = params.bands.map((b, i) =>
      i === closest ? { ...b, frequency: newFreq } : b
    );
    onChange({ ...params, bands });
  }, [params, onChange]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="eq-vis-canvas"
      style={{ cursor: dragIdx >= 0 ? 'grabbing' : 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
    />
  );
}
