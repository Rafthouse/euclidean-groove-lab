/**
 * FX Rack Panel — popup overlay for per-channel effect chains.
 *
 * Visual inspiration: Vital FX Rack (simple, fast, clean, professional).
 *
 * Features:
 *   - Ordered list of insert slots (initially 4, expandable)
 *   - Add Effect from a picker (EQ, Compressor, Delay, Reverb, etc.)
 *   - Per-slot enable/disable toggle
 *   - Per-slot remove
 *   - Drag reorder (via drag-and-drop)
 *   - Per-effect parameter editor (compact, in-line)
 *   - Empty slots show [ Empty ] placeholder
 *
 * Architecture is also used for Master FX Rack (masterChannel).
 */
import { useCallback, useState } from 'react';
import type { FxSlot, BuiltInEffectType, FxParams, EqParams, CompressorParams, DelayParams, ReverbParams, ChorusParams, DistortionParams, FilterParams } from './fxTypes';
import { FX_TYPE_NAMES, createFxSlot } from './fxTypes';
import CompressorModule from '../compressor/CompressorModule';

interface FxRackPanelProps {
  channelName: string;
  channelId: string;
  fxChain: FxSlot[];
  onUpdateChain: (channelId: string, chain: FxSlot[]) => void;
  onClose: () => void;
  /** Available voices for sidechain source selection (for compressor). */
  availableSidechainSources?: string[];
}

// ── Effect Picker ─────────────────────────────────────────────────────

const AVAILABLE_EFFECTS: BuiltInEffectType[] = [
  'eq', 'compressor', 'delay', 'reverb', 'chorus',
  'distortion', 'filter', 'limiter', 'stereoWidth', 'gate',
];

interface EffectPickerProps {
  onSelect: (type: BuiltInEffectType) => void;
  onClose: () => void;
}

function EffectPicker({ onSelect, onClose }: EffectPickerProps) {
  return (
    <div className="fx-picker-overlay" onClick={onClose}>
      <div className="fx-picker" onClick={(e) => e.stopPropagation()}>
        <div className="fx-picker-header">
          <span className="fx-picker-title">Add Effect</span>
          <button className="fx-picker-close" onClick={onClose}>✕</button>
        </div>
        <div className="fx-picker-list">
          {AVAILABLE_EFFECTS.map((type) => (
            <button
              key={type}
              className="fx-picker-item"
              onClick={() => { onSelect(type); onClose(); }}
            >
              {FX_TYPE_NAMES[type]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Parameter Editor Components ────────────────────────────────────────

function EqEditor({ params, onChange }: {
  params: EqParams;
  onChange: (p: EqParams) => void;
}) {
  return (
    <div className="fx-param-grid">
      <label>Low <input type="range" min={-30} max={30} value={params.low} onChange={(e) => onChange({ ...params, low: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{params.low.toFixed(1)} dB</span>
      <label>Mid <input type="range" min={-30} max={30} value={params.mid} onChange={(e) => onChange({ ...params, mid: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{params.mid.toFixed(1)} dB</span>
      <label>High <input type="range" min={-30} max={30} value={params.high} onChange={(e) => onChange({ ...params, high: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{params.high.toFixed(1)} dB</span>
    </div>
  );
}

function CompressorEditor({ params, onChange, sidechainSources, channelName }: {
  params: CompressorParams;
  onChange: (p: CompressorParams) => void;
  sidechainSources?: string[];
  channelName: string;
}) {
  const [fullOpen, setFullOpen] = useState(false);

  return (
    <>
      <div className="fx-param-grid-compact">
        <label>Threshold <input type="range" min={-60} max={0} value={params.threshold} onChange={(e) => onChange({ ...params, threshold: Number(e.target.value) })} /></label>
        <span className="fx-param-value">{params.threshold.toFixed(1)} dB</span>
        <label>Ratio <input type="range" min={1} max={20} step={0.5} value={params.ratio} onChange={(e) => onChange({ ...params, ratio: Number(e.target.value) })} /></label>
        <span className="fx-param-value">{params.ratio.toFixed(1)}:1</span>
        <label>Attack <input type="range" min={0.0001} max={0.5} step={0.0001} value={params.attack} onChange={(e) => onChange({ ...params, attack: Number(e.target.value) })} /></label>
        <span className="fx-param-value">{(params.attack * 1000).toFixed(0)} ms</span>
        <label>Release <input type="range" min={0.005} max={5} step={0.001} value={params.release} onChange={(e) => onChange({ ...params, release: Number(e.target.value) })} /></label>
        <span className="fx-param-value">{(params.release * 1000).toFixed(0)} ms</span>
      </div>
      <button className="fx-open-compressor" onClick={() => setFullOpen(true)}>
        ◉ Open Compressor
      </button>
      {fullOpen && (
        <CompressorModule
          params={params}
          onChange={onChange}
          onClose={() => setFullOpen(false)}
          channelName={channelName}
          sidechainSources={sidechainSources ?? []}
        />
      )}
    </>
  );
}

function DelayEditor({ params, onChange }: {
  params: DelayParams;
  onChange: (p: DelayParams) => void;
}) {
  return (
    <div className="fx-param-grid">
      <label>Time <input type="range" min={0.01} max={1} step={0.01} value={params.time} onChange={(e) => onChange({ ...params, time: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{params.time.toFixed(2)} s</span>
      <label>Feedback <input type="range" min={0} max={0.99} step={0.01} value={params.feedback} onChange={(e) => onChange({ ...params, feedback: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{params.feedback.toFixed(2)}</span>
      <label>Mix <input type="range" min={0} max={1} step={0.01} value={params.mix} onChange={(e) => onChange({ ...params, mix: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{(params.mix * 100).toFixed(0)}%</span>
    </div>
  );
}

function ReverbEditor({ params, onChange }: {
  params: ReverbParams;
  onChange: (p: ReverbParams) => void;
}) {
  return (
    <div className="fx-param-grid">
      <label>Decay <input type="range" min={0.1} max={10} step={0.1} value={params.decay} onChange={(e) => onChange({ ...params, decay: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{params.decay.toFixed(1)} s</span>
      <label>Pre-delay <input type="range" min={0} max={0.1} step={0.001} value={params.preDelay} onChange={(e) => onChange({ ...params, preDelay: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{(params.preDelay * 1000).toFixed(0)} ms</span>
      <label>Mix <input type="range" min={0} max={1} step={0.01} value={params.mix} onChange={(e) => onChange({ ...params, mix: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{(params.mix * 100).toFixed(0)}%</span>
    </div>
  );
}

function ChorusEditor({ params, onChange }: {
  params: ChorusParams;
  onChange: (p: ChorusParams) => void;
}) {
  return (
    <div className="fx-param-grid">
      <label>Freq <input type="range" min={0.1} max={10} step={0.1} value={params.frequency} onChange={(e) => onChange({ ...params, frequency: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{params.frequency.toFixed(1)} Hz</span>
      <label>Delay <input type="range" min={1} max={30} value={params.delayTime} onChange={(e) => onChange({ ...params, delayTime: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{params.delayTime.toFixed(0)} ms</span>
      <label>Depth <input type="range" min={0} max={1} step={0.01} value={params.depth} onChange={(e) => onChange({ ...params, depth: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{params.depth.toFixed(2)}</span>
      <label>Mix <input type="range" min={0} max={1} step={0.01} value={params.mix} onChange={(e) => onChange({ ...params, mix: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{(params.mix * 100).toFixed(0)}%</span>
    </div>
  );
}

function DistortionEditor({ params, onChange }: {
  params: DistortionParams;
  onChange: (p: DistortionParams) => void;
}) {
  return (
    <div className="fx-param-grid">
      <label>Drive <input type="range" min={0} max={1} step={0.01} value={params.distortion} onChange={(e) => onChange({ ...params, distortion: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{(params.distortion * 100).toFixed(0)}%</span>
      <label>Oversample</label>
      <select value={params.oversample} onChange={(e) => onChange({ ...params, oversample: e.target.value as any })}>
        <option value="none">None</option>
        <option value="2x">2x</option>
        <option value="4x">4x</option>
      </select>
    </div>
  );
}

function FilterEditor({ params, onChange }: {
  params: FilterParams;
  onChange: (p: FilterParams) => void;
}) {
  return (
    <div className="fx-param-grid">
      <label>Freq <input type="range" min={20} max={20000} step={1} value={params.frequency} onChange={(e) => onChange({ ...params, frequency: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{params.frequency < 1000 ? `${params.frequency.toFixed(0)} Hz` : `${(params.frequency / 1000).toFixed(2)} kHz`}</span>
      <label>Type</label>
      <select value={params.type} onChange={(e) => onChange({ ...params, type: e.target.value as any })}>
        <option value="lowpass">Low-pass</option>
        <option value="highpass">High-pass</option>
        <option value="bandpass">Band-pass</option>
        <option value="notch">Notch</option>
        <option value="lowshelf">Low-shelf</option>
        <option value="highshelf">High-shelf</option>
        <option value="peaking">Peaking</option>
      </select>
      <label>Resonance <input type="range" min={0.1} max={20} step={0.1} value={params.Q} onChange={(e) => onChange({ ...params, Q: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{params.Q.toFixed(1)}</span>
      <label>Gain <input type="range" min={-40} max={40} step={0.5} value={params.gain} onChange={(e) => onChange({ ...params, gain: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{params.gain.toFixed(1)} dB</span>
    </div>
  );
}

function LimiterEditor({ params, onChange }: { params: any; onChange: (p: any) => void }) {
  return (
    <div className="fx-param-grid">
      <label>Threshold <input type="range" min={-60} max={0} value={params.threshold} onChange={(e) => onChange({ ...params, threshold: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{params.threshold.toFixed(1)} dB</span>
    </div>
  );
}

function StereoWidthEditor({ params, onChange }: { params: any; onChange: (p: any) => void }) {
  return (
    <div className="fx-param-grid">
      <label>Width <input type="range" min={0} max={1} step={0.01} value={params.width} onChange={(e) => onChange({ ...params, width: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{(params.width * 100).toFixed(0)}%</span>
    </div>
  );
}

function GateEditor({ params, onChange }: { params: any; onChange: (p: any) => void }) {
  return (
    <div className="fx-param-grid">
      <label>Threshold <input type="range" min={-60} max={0} value={params.threshold} onChange={(e) => onChange({ ...params, threshold: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{params.threshold.toFixed(1)} dB</span>
      <label>Attack <input type="range" min={0} max={0.05} step={0.001} value={params.attack} onChange={(e) => onChange({ ...params, attack: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{params.attack.toFixed(3)} s</span>
      <label>Release <input type="range" min={0.01} max={1} step={0.01} value={params.release} onChange={(e) => onChange({ ...params, release: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{params.release.toFixed(2)} s</span>
      <label>Hold <input type="range" min={0} max={1} step={0.01} value={params.hold} onChange={(e) => onChange({ ...params, hold: Number(e.target.value) })} /></label>
      <span className="fx-param-value">{params.hold.toFixed(2)} s</span>
    </div>
  );
}

// ── Slot Row ──────────────────────────────────────────────────────────

interface SlotRowProps {
  slot: FxSlot;
  index: number;
  total: number;
  onToggle: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onParamsChange: (params: FxParams) => void;
  slotChannelName: string;
  sidechainSources?: string[];
}

function SlotRow({ slot, index, total, onToggle, onRemove, onMoveUp, onMoveDown, onParamsChange, slotChannelName, sidechainSources }: SlotRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`fx-slot${!slot.enabled ? ' fx-slot-disabled' : ''}`}>
      <div className="fx-slot-header" onClick={() => setExpanded(!expanded)}>
        <div className="fx-slot-controls">
          <button
            className="fx-slot-toggle"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            title={slot.enabled ? 'Disable' : 'Enable'}
          >
            {slot.enabled ? '●' : '○'}
          </button>
          <span className="fx-slot-number">{index + 1}.</span>
          <span className="fx-slot-name">{FX_TYPE_NAMES[slot.type]}</span>
        </div>
        <div className="fx-slot-actions">
          <button className="fx-slot-move" onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={index === 0} title="Move up">▲</button>
          <button className="fx-slot-move" onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={index === total - 1} title="Move down">▼</button>
          <button className="fx-slot-remove" onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Remove">✕</button>
        </div>
      </div>
      {expanded && (
        <div className="fx-slot-editor">
          <ParameterEditor type={slot.type} params={slot.params} onChange={onParamsChange} channelName={slotChannelName} sidechainSources={sidechainSources} />
        </div>
      )}
    </div>
  );
}

// ── Parameter Editor Router ───────────────────────────────────────────

function ParameterEditor({ type, params, onChange, channelName, sidechainSources }: {
  type: BuiltInEffectType;
  params: FxParams;
  onChange: (p: any) => void;
  channelName: string;
  sidechainSources?: string[];
}) {
  switch (type) {
    case 'eq': return <EqEditor params={params as any} onChange={onChange} />;
    case 'compressor': return <CompressorEditor params={params as any} onChange={onChange} channelName={channelName} sidechainSources={sidechainSources} />;
    case 'delay': return <DelayEditor params={params as any} onChange={onChange} />;
    case 'reverb': return <ReverbEditor params={params as any} onChange={onChange} />;
    case 'chorus': return <ChorusEditor params={params as any} onChange={onChange} />;
    case 'distortion': return <DistortionEditor params={params as any} onChange={onChange} />;
    case 'filter': return <FilterEditor params={params as any} onChange={onChange} />;
    case 'limiter': return <LimiterEditor params={params as any} onChange={onChange} />;
    case 'stereoWidth': return <StereoWidthEditor params={params as any} onChange={onChange} />;
    case 'gate': return <GateEditor params={params as any} onChange={onChange} />;
    default: return null;
  }
}

// ── Main FX Rack Panel ────────────────────────────────────────────────

export default function FxRackPanel({
  channelName,
  channelId,
  fxChain,
  onUpdateChain,
  onClose,
  availableSidechainSources,
}: FxRackPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleAddEffect = useCallback((type: BuiltInEffectType) => {
    const newSlot = createFxSlot(type);
    onUpdateChain(channelId, [...fxChain, newSlot]);
  }, [channelId, fxChain, onUpdateChain]);

  const handleRemove = useCallback((index: number) => {
    const next = fxChain.filter((_, i) => i !== index);
    onUpdateChain(channelId, next);
  }, [channelId, fxChain, onUpdateChain]);

  const handleToggle = useCallback((index: number) => {
    const next = fxChain.map((s, i) =>
      i === index ? { ...s, enabled: !s.enabled } : s
    );
    onUpdateChain(channelId, next);
  }, [channelId, fxChain, onUpdateChain]);

  const handleMove = useCallback((index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fxChain.length) return;
    const next = [...fxChain];
    [next[index], next[target]] = [next[target], next[index]];
    onUpdateChain(channelId, next);
  }, [channelId, fxChain, onUpdateChain]);

  const handleParamsChange = useCallback((index: number, params: FxParams) => {
    const next = fxChain.map((s, i) =>
      i === index ? { ...s, params } : s
    );
    onUpdateChain(channelId, next);
  }, [channelId, fxChain, onUpdateChain]);

  return (
    <div className="fx-rack-overlay" onClick={onClose}>
      <div className="fx-rack-panel" onClick={(e) => e.stopPropagation()}>
        <div className="fx-rack-header">
          <span className="fx-rack-title">FX Rack: {channelName}</span>
          <button className="fx-rack-close" onClick={onClose}>✕</button>
        </div>

        <div className="fx-rack-chain">
          {fxChain.length === 0 && (
            <div className="fx-rack-empty">No effects. Click "+ Add Effect" to start.</div>
          )}
          {fxChain.map((slot, index) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              index={index}
              total={fxChain.length}
              onToggle={() => handleToggle(index)}
              onRemove={() => handleRemove(index)}
              onMoveUp={() => handleMove(index, -1)}
              onMoveDown={() => handleMove(index, 1)}
              onParamsChange={(params) => handleParamsChange(index, params)}
              slotChannelName={channelName}
              sidechainSources={availableSidechainSources}
            />
          ))}
        </div>

        <button className="fx-rack-add" onClick={() => setPickerOpen(true)}>
          + Add Effect
        </button>

        {pickerOpen && (
          <EffectPicker
            onSelect={handleAddEffect}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
