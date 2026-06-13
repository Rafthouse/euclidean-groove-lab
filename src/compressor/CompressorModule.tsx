/**
 * Compressor Module V1 – Main Panel Component.
 *
 * Full-featured compressor UI with:
 *   – Standard / Multiband mode toggle
 *   – All parameters: threshold, ratio, attack, release, knee, makeup, dry/wet, lookahead
 *   – Sidechain source + detector filter selection
 *   – Visualizer with GR meter and compression curve
 *   – Per-band controls in multiband mode (solo, mute, bypass)
 *   – A/B internal preset system
 *
 * Integration: used as an overlay triggered from the FX Rack Panel.
 */

import { useCallback, useState } from 'react';
import type { CompressorParams, MultiBandParams } from '../mixer/fxTypes';
import CompressorVisualizer from './CompressorVisualizer';

// ── Preset slots ──────────────────────────────────────────────────────

interface PresetPair {
  a: CompressorParams;
  b: CompressorParams;
}

// ── Props ──────────────────────────────────────────────────────────────

interface CompressorModuleProps {
  params: CompressorParams;
  onChange: (params: CompressorParams) => void;
  onClose: () => void;
  channelName: string;
  /** Voice IDs available as sidechain sources. */
  sidechainSources: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────

const VOICE_LABELS: Record<string, string> = {
  kick: 'Kick', snare: 'Snare', hat: 'Hat', bass: 'Bass',
  ghost: 'Ghost', master: 'Master',
};

const LOOKAHEAD_OPTIONS = [
  { value: 0, label: 'OFF' },
  { value: 0.001, label: '1 ms' },
  { value: 0.005, label: '5 ms' },
  { value: 0.01, label: '10 ms' },
];

function dbFmt(v: number): string {
  return `${v.toFixed(1)} dB`;
}
function msFmt(v: number): string {
  return `${(v * 1000).toFixed(0)} ms`;
}
function pctFmt(v: number): string {
  return `${v.toFixed(0)}%`;
}
function ratioFmt(v: number): string {
  return `${v.toFixed(1)}:1`;
}
function hzFmt(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${v.toFixed(0)} Hz`;
}

// ── Parameter Row ──────────────────────────────────────────────────────

function ParamSlider({ label, value, min, max, step, fmt, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  fmt?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="cmp-param">
      <span className="cmp-param-label">{label}</span>
      <div className="cmp-param-track">
        <div className="cmp-param-fill" style={{ width: `${pct}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step ?? 0.1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="cmp-param-slider"
        />
      </div>
      <span className="cmp-param-value">{fmt ? fmt(value) : value}</span>
    </div>
  );
}

// ── Band Section (for Multiband) ───────────────────────────────────────

function BandSection({ name, band, onChange }: {
  name: string;
  band: MultiBandParams;
  onChange: (b: MultiBandParams) => void;
}) {
  return (
    <div className="cmp-band">
      <div className="cmp-band-header">
        <span className="cmp-band-name">{name}</span>
        <div className="cmp-band-toggles">
          <button
            className={`cmp-band-btn${band.solo ? ' cmp-band-btn-on' : ''}`}
            onClick={() => onChange({ ...band, solo: !band.solo })}
            title="Solo"
          >S</button>
          <button
            className={`cmp-band-btn${band.mute ? ' cmp-band-btn-on' : ''}`}
            onClick={() => onChange({ ...band, mute: !band.mute })}
            title="Mute"
          >M</button>
          <button
            className={`cmp-band-btn${band.bypass ? ' cmp-band-btn-on' : ''}`}
            onClick={() => onChange({ ...band, bypass: !band.bypass })}
            title="Bypass"
          >B</button>
        </div>
      </div>
      <div className="cmp-band-params">
        <ParamSlider label="Thresh" value={band.threshold} min={-60} max={0} fmt={dbFmt} onChange={(v) => onChange({ ...band, threshold: v })} />
        <ParamSlider label="Attack" value={band.attack} min={0.0001} max={0.5} step={0.0001} fmt={msFmt} onChange={(v) => onChange({ ...band, attack: v })} />
        <ParamSlider label="Release" value={band.release} min={0.005} max={5} step={0.001} fmt={msFmt} onChange={(v) => onChange({ ...band, release: v })} />
        <ParamSlider label="Ratio" value={band.ratio} min={1} max={20} fmt={ratioFmt} onChange={(v) => onChange({ ...band, ratio: v })} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
        <ParamSlider label="Makeup" value={band.makeup} min={-24} max={24} fmt={dbFmt} onChange={(v) => onChange({ ...band, makeup: v })} />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export default function CompressorModule({
  params,
  onChange,
  onClose,
  channelName,
  sidechainSources,
}: CompressorModuleProps) {
  const [activePreset, setActivePreset] = useState<'a' | 'b'>('a');
  const [presetPair, setPresetPair] = useState<PresetPair>(() => ({
    a: { ...params },
    b: { ...params },
  }));

  // ── Helpers ────────────────────────────────────────────────────────

  const set = useCallback(
    (partial: Partial<CompressorParams>) => onChange({ ...params, ...partial }),
    [params, onChange],
  );

  const savePreset = useCallback(() => {
    setPresetPair((prev) => ({ ...prev, [activePreset]: { ...params } }));
  }, [params, activePreset]);

  const loadPreset = useCallback(() => {
    onChange({ ...presetPair[activePreset] });
  }, [presetPair, activePreset, onChange]);

  // ── Render ──────────────────────────────────────────────────────────

  const isMb = params.mode === 'multiband';

  return (
    <div className="cmp-overlay" onClick={onClose}>
      <div className="cmp-panel" onClick={(e) => e.stopPropagation()}>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="cmp-header">
          <div className="cmp-header-left">
            <span className="cmp-title">COMPRESSOR</span>
            <span className="cmp-channel-label">{channelName}</span>
          </div>
          <div className="cmp-header-center">
            <button
              className={`cmp-toggle-btn${!isMb ? ' cmp-toggle-active' : ''}`}
              onClick={() => set({ mode: 'standard' })}
            >Compressor</button>
            <button
              className={`cmp-toggle-btn${isMb ? ' cmp-toggle-active' : ''}`}
              onClick={() => set({ mode: 'multiband' })}
            >Multiband</button>
          </div>
          <div className="cmp-header-right">
            <button className="cmp-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* ── Visualizer ──────────────────────────────────────────────── */}
        <div className="cmp-body">
          <CompressorVisualizer params={params} isOpen={true} />
        </div>

        {/* ── Parameters ──────────────────────────────────────────────── */}
        {!isMb && (
          <>
            <div className="cmp-params-row">
              <ParamSlider label="Threshold" value={params.threshold} min={-60} max={0} fmt={dbFmt} onChange={(v) => set({ threshold: v })} />
              <ParamSlider label="Attack" value={params.attack} min={0.0001} max={0.5} step={0.0001} fmt={msFmt} onChange={(v) => set({ attack: v })} />
              <ParamSlider label="Release" value={params.release} min={0.005} max={5} step={0.001} fmt={msFmt} onChange={(v) => set({ release: v })} />
              <ParamSlider label="Ratio" value={params.ratio} min={1} max={20} fmt={ratioFmt} onChange={(v) => set({ ratio: v })} />
            </div>
            <div className="cmp-params-row">
              <ParamSlider label="Knee" value={params.knee} min={0} max={100} fmt={pctFmt} onChange={(v) => set({ knee: v })} />
              <ParamSlider label="Makeup" value={params.makeup} min={-24} max={24} fmt={dbFmt} onChange={(v) => set({ makeup: v })} />
              <ParamSlider label="Dry/Wet" value={params.dryWet} min={0} max={100} fmt={pctFmt} onChange={(v) => set({ dryWet: v })} />
              <div className="cmp-param">
                <span className="cmp-param-label">Lookahead</span>
                <select
                  className="cmp-select"
                  value={params.lookahead}
                  onChange={(e) => set({ lookahead: Number(e.target.value) })}
                >
                  {LOOKAHEAD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <span className="cmp-param-value">&nbsp;</span>
              </div>
            </div>

            {/* ── Sidechain ────────────────────────────────────────────── */}
            <div className="cmp-sidechain">
              <span className="cmp-sc-label">SIDECHAIN</span>
              <div className="cmp-sc-row">
                <select
                  className="cmp-select"
                  value={params.sidechainSource ?? ''}
                  onChange={(e) => set({ sidechainSource: e.target.value || null })}
                >
                  <option value="">Off</option>
                  {sidechainSources.map((id) => (
                    <option key={id} value={id}>{VOICE_LABELS[id] || id}</option>
                  ))}
                </select>
                <select
                  className="cmp-select"
                  value={params.sidechainFilterType}
                  onChange={(e) => set({ sidechainFilterType: e.target.value as any })}
                >
                  <option value="off">Filter: Off</option>
                  <option value="highpass">High-pass</option>
                  <option value="lowpass">Low-pass</option>
                  <option value="bandpass">Band-pass</option>
                </select>
                {params.sidechainFilterType !== 'off' && (
                  <ParamSlider
                    label="Freq"
                    value={params.sidechainFilterFreq}
                    min={20}
                    max={20000}
                    fmt={hzFmt}
                    onChange={(v) => set({ sidechainFilterFreq: v })}
                  />
                )}
              </div>
            </div>

            {/* ── Detector ──────────────────────────────────────────────── */}
            <div className="cmp-detector">
              <span className="cmp-sc-label">DETECTOR</span>
              <div className="cmp-sc-row">
                <button
                  className={`cmp-toggle-sm${params.detector === 'rms' ? ' cmp-toggle-active' : ''}`}
                  onClick={() => set({ detector: 'rms' })}
                >RMS</button>
                <button
                  className={`cmp-toggle-sm${params.detector === 'peak' ? ' cmp-toggle-active' : ''}`}
                  onClick={() => set({ detector: 'peak' })}
                >Peak</button>
              </div>
            </div>
          </>
        )}

        {/* ── Multiband Parameters ──────────────────────────────────────── */}
        {isMb && (
          <>
            <div className="cmp-mb-cross">
              <span className="cmp-sc-label">CROSSOVER</span>
              <ParamSlider label="Low→Mid" value={params.mbCrossoverLow} min={20} max={2000} fmt={hzFmt} onChange={(v) => set({ mbCrossoverLow: v })} />
              <ParamSlider label="Mid→High" value={params.mbCrossoverHigh} min={500} max={20000} fmt={hzFmt} onChange={(v) => set({ mbCrossoverHigh: v })} />
            </div>
            <div className="cmp-mb-bands">
              <BandSection name="LOW" band={params.mbLow} onChange={(b) => set({ mbLow: b })} />
              <BandSection name="MID" band={params.mbMid} onChange={(b) => set({ mbMid: b })} />
              <BandSection name="HIGH" band={params.mbHigh} onChange={(b) => set({ mbHigh: b })} />
            </div>
          </>
        )}

        {/* ── Presets ──────────────────────────────────────────────────── */}
        <div className="cmp-footer">
          <div className="cmp-preset-row">
            <span className="cmp-sc-label">PRESET</span>
            <button
              className={`cmp-preset-btn${activePreset === 'a' ? ' cmp-preset-active' : ''}`}
              onClick={() => { savePreset(); setActivePreset('a'); }}
            >A</button>
            <button
              className={`cmp-preset-btn${activePreset === 'b' ? ' cmp-preset-active' : ''}`}
              onClick={() => { savePreset(); setActivePreset('b'); }}
            >B</button>
            <button className="cmp-preset-btn" onClick={loadPreset}>Load</button>
            <button className="cmp-preset-btn" onClick={savePreset}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
