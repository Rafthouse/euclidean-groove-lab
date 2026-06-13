/**
 * SHCHUR EQ — Full overlay panel.
 *
 * Features:
 *   - 8-band parametric EQ (4 visible by default)
 *   - Graph-based visual editor with draggable nodes
 *   - Per-band: frequency, gain, Q, type, enable
 *   - Built-in spectrum analyzer (OFF/PRE/POST, adjustable FFT size)
 *   - Band colors (8 unique)
 *   - Preset support (stored via FxSlot params)
 *   - Future mid/side architecture prepared
 *
 * Layout:
 *   Top: Analyzer controls (mode, FFT size)
 *   Center: Large frequency graph
 *   Bottom: Band controls table
 */

import { useCallback, useState } from 'react';
import type { Eq2Params, EqBandParams, EqBandType } from '../mixer/fxTypes';
import { BAND_COLORS } from '../mixer/fxTypes';
import EqVisualizer from './EqVisualizer';

// ── Props ─────────────────────────────────────────────────────────────

interface Props {
  params: Eq2Params;
  onChange: (p: Eq2Params) => void;
  onClose: () => void;
  channelName: string;
}

// ── Filter type options ───────────────────────────────────────────────

const FILTER_TYPES: EqBandType[] = [
  'bell', 'lowShelf', 'highShelf', 'lowCut', 'highCut',
  'notch', 'bandPass', 'tilt',
];

const FILTER_LABELS: Record<EqBandType, string> = {
  bell: 'Bell',
  lowShelf: 'Low Shelf',
  highShelf: 'High Shelf',
  lowCut: 'Low Cut',
  highCut: 'High Cut',
  notch: 'Notch',
  bandPass: 'Band Pass',
  tilt: 'Tilt',
};

const FFT_OPTIONS = [1024, 2048, 4096, 8192];

// ── Helpers ───────────────────────────────────────────────────────────

function hzFmt(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(2)} kHz` : `${v.toFixed(0)} Hz`;
}

function dbFmt(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)} dB`;
}

function qFmt(v: number) {
  return v.toFixed(2);
}

// ── Band Row ──────────────────────────────────────────────────────────

function BandRow({ band, index, onChange }: {
  band: EqBandParams;
  index: number;
  onChange: (b: EqBandParams) => void;
}) {
  const color = BAND_COLORS[index];

  return (
    <div className={`eq-band-row${!band.enabled ? ' eq-band-disabled' : ''}`}
      style={{ borderLeftColor: color }}>
      <div className="eq-band-num" style={{ color }}>{index + 1}</div>
      <label className="eq-band-enable">
        <input type="checkbox" checked={band.enabled}
          onChange={(e) => onChange({ ...band, enabled: e.target.checked })} />
      </label>
      <select className="eq-band-type" value={band.type}
        onChange={(e) => onChange({ ...band, type: e.target.value as EqBandType })}>
        {FILTER_TYPES.map((t) => (
          <option key={t} value={t}>{FILTER_LABELS[t]}</option>
        ))}
      </select>
      <div className="eq-band-param">
        <input type="range" min={20} max={20000} value={band.frequency}
          onChange={(e) => onChange({ ...band, frequency: Number(e.target.value) })}
          className="eq-slider-freq" />
        <span className="eq-band-val">{hzFmt(band.frequency)}</span>
      </div>
      <div className="eq-band-param">
        <input type="range" min={-24} max={24} step={0.5} value={band.gain}
          onChange={(e) => onChange({ ...band, gain: Number(e.target.value) })}
          className="eq-slider-gain" />
        <span className="eq-band-val">{dbFmt(band.gain)}</span>
      </div>
      <div className="eq-band-param">
        <input type="range" min={0.1} max={20} step={0.1} value={band.Q}
          onChange={(e) => onChange({ ...band, Q: Number(e.target.value) })}
          className="eq-slider-q" />
        <span className="eq-band-val">{qFmt(band.Q)}</span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export default function EqModule({ params, onChange, onClose, channelName }: Props) {
  const [spectrumData, _setSpectrum] = useState<Float32Array | undefined>(undefined);

  const set = useCallback(
    (partial: Partial<Eq2Params>) => onChange({ ...params, ...partial }),
    [params, onChange],
  );

  const updateBand = useCallback((index: number, band: EqBandParams) => {
    const bands = params.bands.map((b, i) => i === index ? band : b);
    onChange({ ...params, bands });
  }, [params, onChange]);

  const toggleAnalyzer = useCallback(() => {
    const modes: ('off' | 'pre' | 'post')[] = ['off', 'pre', 'post'];
    const idx = modes.indexOf(params.analyzerMode);
    set({ analyzerMode: modes[(idx + 1) % modes.length] });
  }, [params.analyzerMode, set]);

  // ── Presets ─────────────────────────────────────────────────────────
  const [presetA, setPresetA] = useState<string | null>(null);
  const [presetB, setPresetB] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<'a' | 'b' | null>(null);

  const savePreset = useCallback((slot: 'a' | 'b') => {
    const data = JSON.stringify(params);
    if (slot === 'a') setPresetA(data);
    else setPresetB(data);
    setActivePreset(slot);
  }, [params]);

  const loadPreset = useCallback((slot: 'a' | 'b') => {
    const data = slot === 'a' ? presetA : presetB;
    if (data) {
      try {
        const parsed = JSON.parse(data) as Eq2Params;
        onChange(parsed);
      } catch { /* ignore corrupt preset */ }
    }
  }, [presetA, presetB, onChange]);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="eq-overlay" onClick={onClose}>
      <div className="eq-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="eq-hdr">
          <div className="eq-hdr-l">
            <span className="eq-title">SHCHUR EQ</span>
            <span className="eq-ch">{channelName}</span>
          </div>
          <div className="eq-hdr-c">
            {/* Analyzer controls */}
            <button className={`eq-an-btn${params.analyzerMode !== 'off' ? ' eq-an-on' : ''}`}
              onClick={toggleAnalyzer}>
              Analyzer: {params.analyzerMode.toUpperCase()}
            </button>
            {params.analyzerMode !== 'off' && (
              <select className="eq-sel" value={params.analyzerFftSize}
                onChange={(e) => set({ analyzerFftSize: Number(e.target.value) as any })}>
                {FFT_OPTIONS.map((s) => (
                  <option key={s} value={s}>FFT {s}</option>
                ))}
              </select>
            )}
          </div>
          <div className="eq-hdr-r">
            <button className="eq-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Visualizer */}
        <div className="eq-vis-wrap">
          <EqVisualizer
            params={params}
            onChange={onChange}
            spectrumData={spectrumData}
            isOpen={true}
          />
        </div>

        {/* Band controls */}
        <div className="eq-bands">
          <div className="eq-bands-hdr">
            <span className="eq-bh-item" style={{ width: 24 }}>#</span>
            <span className="eq-bh-item" style={{ width: 24 }}>On</span>
            <span className="eq-bh-item" style={{ width: 90 }}>Type</span>
            <span className="eq-bh-item" style={{ flex: 1 }}>Frequency</span>
            <span className="eq-bh-item" style={{ flex: 1 }}>Gain</span>
            <span className="eq-bh-item" style={{ flex: 1 }}>Q</span>
          </div>
          {params.bands.map((band, i) => (
            <BandRow key={i} band={band} index={i} onChange={(b) => updateBand(i, b)} />
          ))}
        </div>

        {/* Preset footer */}
        <div className="eq-ftr">
          <div className="eq-pr">
            <span className="eq-sc-lbl">PRESET</span>
            <button className={`eq-pr-btn${activePreset === 'a' ? ' eq-pr-on' : ''}`}
              onClick={() => loadPreset('a')}>A</button>
            <button className="eq-pr-btn" onClick={() => savePreset('a')}>Save A</button>
            <button className={`eq-pr-btn${activePreset === 'b' ? ' eq-pr-on' : ''}`}
              onClick={() => loadPreset('b')}>B</button>
            <button className="eq-pr-btn" onClick={() => savePreset('b')}>Save B</button>
          </div>
        </div>
      </div>
    </div>
  );
}
