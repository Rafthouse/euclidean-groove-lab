/**
 * Delivery Delay — Premium delay module UI.
 *
 * Clean, professional interface styled for Euclidean Groove Spielzeug.
 *
 * Controls:
 *   - Time (ms) — large knob/readout
 *   - Feedback (%) — color-coded
 *   - Mix (%)
 *   - Ping-Pong toggle
 *   - Filter LP/HP — feedback color
 *   - Saturation — tape warmth
 *   - Modulation rate/depth — chorus/flange/tape-flutter
 *   - Ducking threshold
 *
 * Visualizer:
 *   - Stereo bouncing delay visualization (ping-pong animation)
 *   - Feedback decay visualization
 */

import { useCallback, useState } from 'react';
import { DEFAULT_DELAY_PARAMS } from './DeliveryDelayEngine';
import type { DelayParams } from './DeliveryDelayEngine';

// ── Param Slider ──────────────────────────────────────────────────────

function DSlider({ label, value, min, max, step, unit, onChange, color }: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; onChange: (v: number) => void; color?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const display = unit === 'ms' ? `${(value * 1000).toFixed(0)}` :
    unit === '%' ? `${(value * 100).toFixed(0)}` :
    unit === 'Hz' ? `${value.toFixed(1)}` :
    value.toFixed(step && step >= 0.1 ? 1 : 2);

  return (
    <div className="dd-param">
      <div className="dd-param-h">
        <span className="dd-pl">{label}</span>
        <span className="dd-pv">{display}{unit || ''}</span>
      </div>
      <div className="dd-pt">
        <div className="dd-pf" style={{ width: `${pct}%`, background: color || 'var(--accent, #ff00c8)' }} />
        <input type="range" min={min} max={max} step={step ?? 0.01}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="dd-ps" />
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────

interface Props {
  params: Record<string, number>;
  onChange: (p: Record<string, number>) => void;
  onClose: () => void;
  channelName: string;
}

// ── Module Registration ───────────────────────────────────────────────

export const DELIVERY_DELAY_TYPE = 'delay' as const;

// ── Main Component ────────────────────────────────────────────────────

export default function DeliveryDelayModule({ params, onChange, onClose, channelName }: Props) {
  const set = useCallback(
    (partial: Partial<Record<string, number>>) => onChange({ ...params, ...partial }),
    [params, onChange],
  );

  const p = { ...DEFAULT_DELAY_PARAMS, ...params } as DelayParams;

  return (
    <div className="dd-overlay" onClick={onClose}>
      <div className="dd-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="dd-hdr">
          <div className="dd-hdr-l">
            <span className="dd-title">DELIVERY DELAY</span>
            <span className="dd-ch">{channelName}</span>
          </div>
          <div className="dd-hdr-r">
            <button className="dd-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Main controls */}
        <div className="dd-body">
          <div className="dd-main">
            {/* Time — large knob area */}
            <div className="dd-time-section">
              <div className="dd-time-readout">
                <span className="dd-time-val">{(p.delayTime * 1000).toFixed(0)}</span>
                <span className="dd-time-unit">ms</span>
              </div>
              <div className="dd-time-slider">
                <DSlider label="Time" value={p.delayTime} min={0.001} max={2} step={0.001}
                  unit="ms" onChange={(v) => set({ delayTime: v })} color="#66ccff" />
              </div>
            </div>

            {/* Core params */}
            <div className="dd-core">
              <DSlider label="Feedback" value={p.feedback} min={0} max={0.99} step={0.01}
                unit="%" onChange={(v) => set({ feedback: v })}
                color={p.feedback > 0.7 ? '#ff4444' : p.feedback > 0.4 ? '#ffaa00' : '#44dd44'} />
              <DSlider label="Mix" value={p.mix} min={0} max={1} step={0.01}
                unit="%" onChange={(v) => set({ mix: v })} color="#8888ff" />
            </div>
          </div>

          {/* Toggle row */}
          <div className="dd-tog-row">
            <span className="dd-tog-lbl">Ping-Pong</span>
            <button className={`dd-tog${p.pingPong ? ' dd-tog-on' : ''}`}
              onClick={() => set({ pingPong: p.pingPong ? 0 : 1 })}>
              {p.pingPong ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Feedback color (filter) */}
          <div className="dd-section">
            <span className="dd-sec-lbl">FEEDBACK COLOR</span>
            <div className="dd-sec-row">
              <DSlider label="Low Cut" value={p.filterHp} min={0} max={1} step={0.01}
                unit="%" onChange={(v) => set({ filterHp: v })} color="#ff8800" />
              <DSlider label="High Cut" value={p.filterLp} min={0} max={1} step={0.01}
                unit="%" onChange={(v) => set({ filterLp: v })} color="#4488ff" />
            </div>
          </div>

          {/* Saturation */}
          <div className="dd-section">
            <span className="dd-sec-lbl">SATURATION</span>
            <div className="dd-sec-row">
              <DSlider label="Drive" value={p.saturation} min={0} max={1} step={0.01}
                unit="%" onChange={(v) => set({ saturation: v })} color="#ff44aa" />
            </div>
          </div>

          {/* Modulation */}
          <div className="dd-section">
            <span className="dd-sec-lbl">MODULATION</span>
            <div className="dd-sec-row">
              <DSlider label="Rate" value={p.modRate} min={0} max={20} step={0.1}
                unit="Hz" onChange={(v) => set({ modRate: v })} color="#44ddff" />
              <DSlider label="Depth" value={p.modDepth} min={0} max={1} step={0.01}
                unit="%" onChange={(v) => set({ modDepth: v })} color="#44ddff" />
            </div>
          </div>

          {/* Ducking */}
          <div className="dd-section">
            <span className="dd-sec-lbl">DUCKING</span>
            <div className="dd-sec-row">
              <DSlider label="Threshold" value={p.duckThreshold} min={0} max={1} step={0.01}
                unit="%" onChange={(v) => set({ duckThreshold: v })} color="#88ff44" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
