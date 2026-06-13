/**
 * Delivery Delay — premium delay UI (knobs only).
 *
 * Layout:
 *   ┌─────────────────────────────────┐
 *   │  DELIVERY DELAY    [channel]    │
 *   │                                 │
 *   │      ╭───╮                      │
 *   │      │TIME│    (big central)    │
 *   │      ╰───╯                      │
 *   │  ╭───╮ ╭───╮ ╭───╮ ╭───╮       │
 *   │  │FB │ │MIX│ │COL│ │DRV│       │
 *   │  ╰───╯ ╰───╯ ╰───╯ ╰───╯       │
 *   │  ╭───╮ ╭───╮ ╭───╮            │
 *   │  │MOD│ │DPT│ │DUK│ [PP]        │
 *   │  ╰───╯ ╰───╯ ╰───╯            │
 *   └─────────────────────────────────┘
 *
 * No sliders. Knobs only with CircularKnob component.
 */

import { useCallback } from 'react';
import CircularKnob from '../../components/CircularKnob';
import { DEFAULT_DELAY_PARAMS } from './DeliveryDelayEngine';
import type { DeliveryDelayParams } from './DeliveryDelayEngine';

interface Props {
  params: Record<string, number>;
  onChange: (p: Record<string, number>) => void;
  onClose: () => void;
  channelName: string;
}

export default function DeliveryDelayUI({ params, onChange, onClose, channelName }: Props) {
  const p = { ...DEFAULT_DELAY_PARAMS, ...params } as DeliveryDelayParams;
  const set = useCallback(
    (partial: Partial<Record<string, number>>) => onChange({ ...params, ...partial }),
    [params, onChange],
  );

  return (
    <div className="efx-overlay" onClick={onClose}>
      <div className="efx-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="efx-hdr">
          <div className="efx-hdr-l">
            <span className="efx-title">DELIVERY DELAY</span>
          </div>
          <div className="efx-hdr-r">
            <span className="efx-ch">{channelName}</span>
            <button className="efx-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Time — hero knob */}
        <div className="efx-hero">
          <CircularKnob
            value={p.time}
            min={0.001} max={2} step={0.001}
            defaultValue={DEFAULT_DELAY_PARAMS.time}
            label="TIME"
            unit="ms"
            size={80}
            color="#66ccff"
            onChange={(v) => set({ time: v })}
          />
        </div>

        {/* Row 1: Core params */}
        <div className="efx-row">
          <CircularKnob
            value={p.feedback} min={0} max={0.99} step={0.01}
            defaultValue={DEFAULT_DELAY_PARAMS.feedback}
            label="FEEDBACK" unit="%"
            color={p.feedback > 0.7 ? '#ff4444' : p.feedback > 0.4 ? '#ffaa00' : '#44dd44'}
            onChange={(v) => set({ feedback: v })}
          />
          <CircularKnob
            value={p.mix} min={0} max={1} step={0.01}
            defaultValue={DEFAULT_DELAY_PARAMS.mix}
            label="MIX" unit="%"
            color="#8888ff"
            onChange={(v) => set({ mix: v })}
          />
          <CircularKnob
            value={p.color} min={0} max={1} step={0.01}
            defaultValue={DEFAULT_DELAY_PARAMS.color}
            label="COLOR" unit="%"
            color="#ff8844"
            onChange={(v) => set({ color: v })}
          />
          <CircularKnob
            value={p.drive} min={0} max={1} step={0.01}
            defaultValue={DEFAULT_DELAY_PARAMS.drive}
            label="DRIVE" unit="%"
            color="#ff44aa"
            onChange={(v) => set({ drive: v })}
          />
        </div>

        {/* Row 2: Modulation + Ducking + Ping-pong toggle */}
        <div className="efx-row">
          <CircularKnob
            value={p.modRate} min={0} max={12} step={0.1}
            defaultValue={DEFAULT_DELAY_PARAMS.modRate}
            label="MOD RATE" unit="Hz"
            color="#44ddff"
            onChange={(v) => set({ modRate: v })}
          />
          <CircularKnob
            value={p.modDepth} min={0} max={1} step={0.01}
            defaultValue={DEFAULT_DELAY_PARAMS.modDepth}
            label="MOD DPT" unit="%"
            color="#44ddff"
            onChange={(v) => set({ modDepth: v })}
          />
          <CircularKnob
            value={p.duck} min={0} max={1} step={0.01}
            defaultValue={DEFAULT_DELAY_PARAMS.duck}
            label="DUCK" unit="%"
            color="#88ff44"
            onChange={(v) => set({ duck: v })}
          />
          {/* Ping-pong toggle as a compact button */}
          <div className="efx-toggle-wrapper">
            <div className="ck-container">
              <div className="ck-knob efx-toggle-btn"
                onClick={() => set({ pingPong: p.pingPong ? 0 : 1 })}
                title="Toggle Ping-Pong">
                <svg width={48} height={48} viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="18" fill="none"
                    stroke={p.pingPong ? '#66ccff' : 'rgba(255,255,255,0.06)'}
                    strokeWidth="3" />
                  <text x="24" y="25" textAnchor="middle" fill={p.pingPong ? '#66ccff' : '#666'}
                    fontSize="10" fontWeight="700" letterSpacing="1">
                    PP
                  </text>
                  {p.pingPong && (
                    <>
                      <circle cx="14" cy="18" r="3" fill="#66ccff" opacity="0.6" />
                      <circle cx="34" cy="30" r="3" fill="#66ccff" opacity="0.6" />
                    </>
                  )}
                </svg>
              </div>
              <div style={{ textAlign: 'center', marginTop: 2 }}>
                <div className="ck-label">PING-PONG</div>
                <div className="ck-value" style={{ color: p.pingPong ? '#66ccff' : '#555' }}>
                  {p.pingPong ? 'ON' : 'OFF'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
