/**
 * Compressor Module — Full overlay panel.
 *
 * Features:
 *   - Standard / Multiband mode toggle
 *   - All standard params: threshold, ratio, attack, release, knee, makeup, dry/wet, lookahead
 *   - Sidechain source + detector filter (standard mode only)
 *   - RMS/Peak detector toggle
 *   - Multiband per-band: thresh, attack, release, ratio, makeup, solo, mute, bypass
 *   - Crossover controls in multiband mode
 *   - Visualizer with GR meter and compression curve
 *   - A/B preset slots (save/load/swap)
 *   - Anti-click smoothing delegated to engine
 */

import { useCallback, useState } from 'react';
import type { CompressorParams, MultiBandParams } from '../mixer/fxTypes';
import CompressorVisualizer from './CompressorVisualizer';

// ── Presets ───────────────────────────────────────────────────────────

interface PresetPair {
  a: CompressorParams;
  b: CompressorParams;
}

function deepClone(obj: CompressorParams): CompressorParams {
  return JSON.parse(JSON.stringify(obj));
}

// ── Props ─────────────────────────────────────────────────────────────

interface Props {
  params: CompressorParams;
  onChange: (params: CompressorParams) => void;
  onClose: () => void;
  channelName: string;
  /** Voice IDs available for sidechain source selection. */
  sidechainSources: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────

const VOICE_LABELS: Record<string, string> = {
  kick: 'Kick', snare: 'Snare', hat: 'Hat', bass: 'Bass',
  ghost: 'Ghost', master: 'Master',
};

const LOOKAHEAD_OPTS = [
  { value: 0, label: 'OFF' },
  { value: 0.001, label: '1 ms' },
  { value: 0.005, label: '5 ms' },
  { value: 0.01, label: '10 ms' },
];

function dbFmt(v: number) { return `${v.toFixed(1)} dB`; }
function msFmt(v: number) { return `${(v * 1000).toFixed(0)} ms`; }
function pctFmt(v: number) { return `${v.toFixed(0)}%`; }
function ratioFmt(v: number) { return `${v.toFixed(1)}:1`; }
function hzFmt(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${v.toFixed(0)} Hz`;
}

// ── ParamSlider ───────────────────────────────────────────────────────

function ParamSlider({ label, value, min, max, step, fmt, onChange }: {
  label: string; value: number; min: number; max: number;
  step?: number; fmt?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="cmp-param">
      <span className="cmp-pl">{label}</span>
      <div className="cmp-pt">
        <div className="cmp-pf" style={{ width: `${pct}%` }} />
        <input type="range" min={min} max={max} step={step ?? 0.1}
          value={value} onChange={(e) => onChange(Number(e.target.value))}
          className="cmp-ps" />
      </div>
      <span className="cmp-pv">{fmt ? fmt(value) : value}</span>
    </div>
  );
}

// ── Band Section ──────────────────────────────────────────────────────

function BandSection({ name, band, onChange }: {
  name: string; band: MultiBandParams;
  onChange: (b: MultiBandParams) => void;
}) {
  return (
    <div className="cmp-band">
      <div className="cmp-band-h">
        <span className="cmp-band-n">{name}</span>
        <div className="cmp-band-t">
          {(['solo','mute','bypass'] as const).map((k) => (
            <button key={k}
              className={`cmp-band-b${band[k] ? ' cmp-band-on' : ''}`}
              onClick={() => onChange({ ...band, [k]: !band[k] })}
            >{k[0].toUpperCase()}</button>
          ))}
        </div>
      </div>
      <ParamSlider label="Thr" value={band.threshold} min={-60} max={0} fmt={dbFmt}
        onChange={(v) => onChange({ ...band, threshold: v })} />
      <ParamSlider label="Atk" value={band.attack} min={0.0001} max={0.5} step={0.0001} fmt={msFmt}
        onChange={(v) => onChange({ ...band, attack: v })} />
      <ParamSlider label="Rel" value={band.release} min={0.005} max={5} step={0.001} fmt={msFmt}
        onChange={(v) => onChange({ ...band, release: v })} />
      <ParamSlider label="Rat" value={band.ratio} min={1} max={20} fmt={ratioFmt}
        onChange={(v) => onChange({ ...band, ratio: v })} />
      <ParamSlider label="Mak" value={band.makeup} min={-24} max={24} fmt={dbFmt}
        onChange={(v) => onChange({ ...band, makeup: v })} />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export default function CompressorModule({
  params, onChange, onClose, channelName, sidechainSources,
}: Props) {
  const [activePreset, setActivePreset] = useState<'a' | 'b'>('a');
  const [presets, setPresets] = useState<PresetPair>(() => ({
    a: deepClone(params),
    b: deepClone(params),
  }));

  const set = useCallback(
    (partial: Partial<CompressorParams>) => onChange({ ...params, ...partial }),
    [params, onChange],
  );

  const savePreset = useCallback(() => {
    setPresets((prev) => ({ ...prev, [activePreset]: deepClone(params) }));
  }, [params, activePreset]);

  const loadPreset = useCallback(() => {
    onChange(deepClone(presets[activePreset]));
  }, [presets, activePreset, onChange]);

  const swapAB = useCallback(() => {
    setPresets((prev) => ({ a: prev.b, b: prev.a }));
  }, []);

  const isMb = params.mode === 'multiband';

  return (
    <div className="cmp-overlay" onClick={onClose}>
      <div className="cmp-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cmp-hdr">
          <div className="cmp-hdr-l">
            <span className="cmp-title">COMPRESSOR</span>
            <span className="cmp-ch">{channelName}</span>
          </div>
          <div className="cmp-hdr-c">
            <button className={`cmp-tog${!isMb ? ' cmp-tog-on' : ''}`}
              onClick={() => set({ mode: 'standard' })}>Compressor</button>
            <button className={`cmp-tog${isMb ? ' cmp-tog-on' : ''}`}
              onClick={() => set({ mode: 'multiband' })}>Multiband</button>
          </div>
          <div className="cmp-hdr-r">
            <button className="cmp-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Visualizer */}
        <div className="cmp-viz-wrap">
          <CompressorVisualizer params={params} isOpen={true} />
        </div>

        {/* Standard Mode Params */}
        {!isMb && (
          <>
            <div className="cmp-params-row">
              <ParamSlider label="Threshold" value={params.threshold} min={-60} max={0} fmt={dbFmt}
                onChange={(v) => set({ threshold: v })} />
              <ParamSlider label="Ratio" value={params.ratio} min={1} max={20} fmt={ratioFmt}
                onChange={(v) => set({ ratio: v })} />
              <ParamSlider label="Attack" value={params.attack} min={0.0001} max={0.5} step={0.0001} fmt={msFmt}
                onChange={(v) => set({ attack: v })} />
              <ParamSlider label="Release" value={params.release} min={0.005} max={5} step={0.001} fmt={msFmt}
                onChange={(v) => set({ release: v })} />
            </div>
            <div className="cmp-params-row">
              <ParamSlider label="Knee" value={params.knee} min={0} max={1} step={0.01} fmt={pctFmt}
                onChange={(v) => set({ knee: v })} />
              <ParamSlider label="Makeup" value={params.makeup} min={-24} max={24} fmt={dbFmt}
                onChange={(v) => set({ makeup: v })} />
              <ParamSlider label="Dry/Wet" value={params.dryWet} min={0} max={1} step={0.01} fmt={pctFmt}
                onChange={(v) => set({ dryWet: v })} />
              <div className="cmp-param">
                <span className="cmp-pl">Lookahead</span>
                <select className="cmp-sel" value={params.lookahead}
                  onChange={(e) => set({ lookahead: Number(e.target.value) })}>
                  {LOOKAHEAD_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <span className="cmp-pv">&nbsp;</span>
              </div>
            </div>

            {/* Sidechain + Detector */}
            <div className="cmp-sc-row">
              <span className="cmp-sc-lbl">SIDECHAIN</span>
              <select className="cmp-sel" value={params.sidechainSource ?? ''}
                onChange={(e) => set({ sidechainSource: e.target.value || null })}>
                <option value="">Off</option>
                {sidechainSources.map((id) => (
                  <option key={id} value={id}>{VOICE_LABELS[id] || id}</option>
                ))}
              </select>
              <select className="cmp-sel" value={params.sidechainFilterType}
                onChange={(e) => set({ sidechainFilterType: e.target.value as any })}>
                <option value="off">Filter: Off</option>
                <option value="highpass">High-pass</option>
                <option value="lowpass">Low-pass</option>
                <option value="bandpass">Band-pass</option>
              </select>
              {params.sidechainFilterType !== 'off' && (
                <ParamSlider label="Freq" value={params.sidechainFilterFreq}
                  min={20} max={20000} fmt={hzFmt}
                  onChange={(v) => set({ sidechainFilterFreq: v })} />
              )}
            </div>

            <div className="cmp-det-row">
              <span className="cmp-sc-lbl">DETECTOR</span>
              <button className={`cmp-tog-sm${params.detector === 'rms' ? ' cmp-tog-on' : ''}`}
                onClick={() => set({ detector: 'rms' })}>RMS</button>
              <button className={`cmp-tog-sm${params.detector === 'peak' ? ' cmp-tog-on' : ''}`}
                onClick={() => set({ detector: 'peak' })}>Peak</button>
            </div>
          </>
        )}

        {/* Multiband Mode */}
        {isMb && (
          <>
            <div className="cmp-mb-xo">
              <span className="cmp-sc-lbl">CROSSOVER</span>
              <ParamSlider label="Low→Mid" value={params.mbCrossoverLow} min={20} max={2000} fmt={hzFmt}
                onChange={(v) => set({ mbCrossoverLow: v })} />
              <ParamSlider label="Mid→High" value={params.mbCrossoverHigh} min={500} max={20000} fmt={hzFmt}
                onChange={(v) => set({ mbCrossoverHigh: v })} />
            </div>
            <div className="cmp-mb-bands">
              <BandSection name="LOW" band={params.mbLow}
                onChange={(b) => set({ mbLow: b })} />
              <BandSection name="MID" band={params.mbMid}
                onChange={(b) => set({ mbMid: b })} />
              <BandSection name="HIGH" band={params.mbHigh}
                onChange={(b) => set({ mbHigh: b })} />
            </div>
          </>
        )}

        {/* Presets Footer */}
        <div className="cmp-ftr">
          <div className="cmp-pr">
            <span className="cmp-sc-lbl">PRESET</span>
            <button className={`cmp-pr-btn${activePreset === 'a' ? ' cmp-pr-on' : ''}`}
              onClick={() => { savePreset(); setActivePreset('a'); }}>A</button>
            <button className={`cmp-pr-btn${activePreset === 'b' ? ' cmp-pr-on' : ''}`}
              onClick={() => { savePreset(); setActivePreset('b'); }}>B</button>
            <button className="cmp-pr-btn" onClick={loadPreset}>Load</button>
            <button className="cmp-pr-btn" onClick={savePreset}>Save</button>
            <button className="cmp-pr-btn" onClick={swapAB}>⇄</button>
          </div>
        </div>
      </div>
    </div>
  );
}
