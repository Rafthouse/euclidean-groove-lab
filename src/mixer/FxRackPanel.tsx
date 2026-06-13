/**
 * FX Rack Panel — premium clean effect list.
 *
 * Design:
 *   - Minimal. Dark. Professional.
 *   - No sliders, no inline controls, no previews.
 *   - Each row: Name | Enable/Disable | Open | Move Up | Move Down | Delete
 *   - Effect picker: clean dropdown with categories.
 *   - All editing: dedicated full-screen windows with knobs only.
 *
 * Inspired by: Ableton Live FX browser, FabFilter Pro-Q chain.
 */

import { useCallback, useState } from 'react';
import type { FxSlot, BuiltInEffectType, FxParams } from './fxTypes';
import { FX_TYPE_NAMES, createFxSlot } from './fxTypes';
import CompressorModule from '../compressor/CompressorModule';
import EqModule from '../eq/EqModule';
import DeliveryDelayUI from '../effects/delay/DeliveryDelayUI';

// ── Props ─────────────────────────────────────────────────────────────

interface FxRackPanelProps {
  channelName: string;
  channelId: string;
  fxChain: FxSlot[];
  onUpdateChain: (channelId: string, chain: FxSlot[]) => void;
  onClose: () => void;
  availableSidechainSources?: string[];
}

// ── Available effects ───────────────────────────────────────────────────

const AVAILABLE_EFFECTS: { type: BuiltInEffectType; label: string; group: string }[] = [
  { type: 'eq2',     label: 'SHCHUR EQ',        group: 'Equalizer' },
  { type: 'eq',      label: 'EQ (basic)',        group: 'Equalizer' },
  { type: 'compressor',  label: 'Compressor',    group: 'Dynamics' },
  { type: 'limiter',     label: 'Limiter',       group: 'Dynamics' },
  { type: 'gate',        label: 'Gate',          group: 'Dynamics' },
  { type: 'deliveryDelay', label: 'Delivery Delay', group: 'Delay' },
  { type: 'delay',       label: 'Delay (basic)',  group: 'Delay' },
  { type: 'reverb',      label: 'Reverb',         group: 'Reverb' },
  { type: 'chorus',      label: 'Chorus',         group: 'Modulation' },
  { type: 'distortion',  label: 'Distortion',     group: 'Distortion' },
  { type: 'filter',      label: 'Filter',         group: 'Filter' },
  { type: 'stereoWidth', label: 'Stereo Width',   group: 'Spatial' },
];

// ── Editor Router ─────────────────────────────────────────────────────

type EditorType = 'eq2' | 'compressor' | 'deliveryDelay' | 'universal';

function editorFor(type: BuiltInEffectType): EditorType {
  switch (type) {
    case 'eq2': return 'eq2';
    case 'compressor': return 'compressor';
    case 'deliveryDelay': return 'deliveryDelay';
    default: return 'universal';
  }
}

function EditorWindow({ type, params, onChange, onClose, channelName, sidechainSources }: {
  type: BuiltInEffectType;
  params: FxParams;
  onChange: (p: FxParams) => void;
  onClose: () => void;
  channelName: string;
  sidechainSources?: string[];
}) {
  const editor = editorFor(type);

  switch (editor) {
    case 'eq2':
      return (
        <EqModule params={params as any}
          onChange={onChange} onClose={onClose} channelName={channelName} />
      );
    case 'compressor':
      return (
        <CompressorModule params={params as any}
          onChange={onChange} onClose={onClose} channelName={channelName}
          sidechainSources={sidechainSources ?? []} />
      );
    case 'deliveryDelay':
      return (
        <DeliveryDelayUI params={params as any}
          onChange={onChange} onClose={onClose} channelName={channelName} />
      );
    default:
      return (
        <UniversalEditor params={params}
          onChange={onChange} onClose={onClose} type={type} channelName={channelName} />
      );
  }
}

function UniversalEditor({ params, onChange, onClose, type, channelName }: {
  params: FxParams;
  onChange: (p: FxParams) => void;
  onClose: () => void;
  type: BuiltInEffectType;
  channelName: string;
}) {
  const p = params as any;
  return (
    <div className="efx-overlay" onClick={onClose}>
      <div className="efx-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="efx-hdr">
          <div className="efx-hdr-l">
            <span className="efx-title">{FX_TYPE_NAMES[type]}</span>
          </div>
          <div className="efx-hdr-r">
            <span className="efx-ch">{channelName}</span>
            <button className="efx-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div style={{ padding: '8px 0' }}>
          {Object.keys(p).map((key) => {
            if (typeof p[key] !== 'number') return null;
            const isDb = /threshold|makeup|gain/.test(key);
            const isTime = /attack|release|time/.test(key);
            const isMix = /mix|dry|wet|depth|feedback/.test(key);
            const isFreq = /freq/u.test(key) || key === 'frequency';
            const isRatio = key === 'ratio';
            let min = 0, max = 1, step = 0.01;
            if (isDb) { min = -60; max = 24; step = 0.5; }
            else if (isTime) { min = 0; max = 5; step = 0.001; }
            else if (isMix) { min = 0; max = 1; step = 0.01; }
            else if (isFreq) { min = 20; max = 20000; step = 1; }
            else if (isRatio) { min = 1; max = 20; step = 0.5; }

            let display = p[key].toFixed(step >= 1 ? 0 : step >= 0.1 ? 1 : 2);
            if (isDb) display += ' dB';
            else if (isTime) display += (p[key] >= 1 ? ' s' : ' ms');
            else if (isMix) display = `${(p[key] * 100).toFixed(0)}%`;
            else if (isFreq) display = p[key] >= 1000 ? `${(p[key] / 1000).toFixed(2)} kHz` : `${p[key].toFixed(0)} Hz`;
            else if (isRatio) display = `${p[key].toFixed(1)}:1`;

            return (
              <div key={key} className="ue-row">
                <div className="ue-info">
                  <span className="ue-label">{key.replace(/([A-Z])/g,' $1').trim()}</span>
                  <span className="ue-value">{display}</span>
                </div>
                <div className="ue-track">
                  <div className="ue-fill" style={{ width: `${((p[key] - min) / (max - min)) * 100}%` }} />
                  <input type="range" min={min} max={max} step={step}
                    value={p[key]}
                    onChange={(e) => onChange({ ...p, [key]: Number(e.target.value) })}
                    className="ue-slider" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Effect Picker ─────────────────────────────────────────────────────

function EffectPicker({ onSelect, onClose }: {
  onSelect: (type: BuiltInEffectType) => void;
  onClose: () => void;
}) {
  const groups = AVAILABLE_EFFECTS.reduce((acc, ef) => {
    if (!acc[ef.group]) acc[ef.group] = [];
    acc[ef.group].push(ef);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_EFFECTS>);

  return (
    <div className="ep-overlay" onClick={onClose}>
      <div className="ep-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ep-hdr">
          <span className="ep-title">ADD EFFECT</span>
          <button className="ep-close" onClick={onClose}>✕</button>
        </div>
        {Object.entries(groups).map(([group, effects]) => (
          <div key={group} className="ep-group">
            <div className="ep-group-lbl">{group}</div>
            {effects.map((ef) => (
              <button key={ef.type} className="ep-item"
                onClick={() => { onSelect(ef.type); onClose(); }}>
                {ef.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Slot Row ─────────────────────────────────────────────────────────

function SlotRow({ slot, index, total, onToggle, onRemove, onMoveUp, onMoveDown, onChangeParams, slotChannelName, sidechainSources }: {
  slot: FxSlot;
  index: number;
  total: number;
  onToggle: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChangeParams: (p: FxParams) => void;
  slotChannelName: string;
  sidechainSources?: string[];
}) {
  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <>
      <div className={`fx-slot${!slot.enabled ? ' fx-slot-disabled' : ''}`}>
        <div className="fx-slot-indicator">
          <button className={`fx-slot-power${slot.enabled ? ' fx-slot-power-on' : ''}`}
            onClick={onToggle} title={slot.enabled ? 'Disable' : 'Enable'} />
        </div>
        <div className="fx-slot-body">
          <span className="fx-slot-num">{String(index + 1).padStart(2, '0')}</span>
          <span className="fx-slot-name">{FX_TYPE_NAMES[slot.type]}</span>
        </div>
        <div className="fx-slot-actions">
          <button className="fx-slot-open" onClick={() => setEditorOpen(true)} title="Open Editor">
            OPEN
          </button>
          <button className="fx-slot-arrow" onClick={onMoveUp} disabled={index === 0} title="Move Up">▲</button>
          <button className="fx-slot-arrow" onClick={onMoveDown} disabled={index === total - 1} title="Move Down">▼</button>
          <button className="fx-slot-del" onClick={onRemove} title="Remove">✕</button>
        </div>
      </div>
      {editorOpen && (
        <EditorWindow
          type={slot.type}
          params={slot.params}
          onChange={onChangeParams}
          onClose={() => setEditorOpen(false)}
          channelName={slotChannelName}
          sidechainSources={sidechainSources}
        />
      )}
    </>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────

export default function FxRackPanel({
  channelName, channelId, fxChain, onUpdateChain, onClose, availableSidechainSources,
}: FxRackPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const addEffect = useCallback((type: BuiltInEffectType) => {
    onUpdateChain(channelId, [...fxChain, createFxSlot(type)]);
  }, [channelId, fxChain, onUpdateChain]);

  const removeFx = useCallback((i: number) => {
    onUpdateChain(channelId, fxChain.filter((_, idx) => idx !== i));
  }, [channelId, fxChain, onUpdateChain]);

  const toggleFx = useCallback((i: number) => {
    onUpdateChain(channelId, fxChain.map((s, idx) =>
      idx === i ? { ...s, enabled: !s.enabled } : s,
    ));
  }, [channelId, fxChain, onUpdateChain]);

  const moveFx = useCallback((i: number, d: -1 | 1) => {
    const t = i + d;
    if (t < 0 || t >= fxChain.length) return;
    const next = [...fxChain];
    [next[i], next[t]] = [next[t], next[i]];
    onUpdateChain(channelId, next);
  }, [channelId, fxChain, onUpdateChain]);

  const setParams = useCallback((i: number, p: FxParams) => {
    onUpdateChain(channelId, fxChain.map((s, idx) => idx === i ? { ...s, params: p } : s));
  }, [channelId, fxChain, onUpdateChain]);

  return (
    <div className="fx-rack-overlay" onClick={onClose}>
      <div className="fx-rack-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="fx-rack-header">
          <div className="fx-rack-hdr-l">
            <span className="fx-rack-title">FX RACK</span>
            <span className="fx-rack-ch">{channelName}</span>
          </div>
          <button className="fx-rack-close" onClick={onClose}>✕</button>
        </div>

        {/* Chain */}
        <div className="fx-rack-chain">
          {fxChain.length === 0 && (
            <div className="fx-rack-empty">
              <span>No effects</span>
              <span className="fx-rack-empty-sub">Click +ADD to insert</span>
            </div>
          )}
          {fxChain.map((slot, i) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              index={i}
              total={fxChain.length}
              onToggle={() => toggleFx(i)}
              onRemove={() => removeFx(i)}
              onMoveUp={() => moveFx(i, -1)}
              onMoveDown={() => moveFx(i, 1)}
              onChangeParams={(p) => setParams(i, p)}
              slotChannelName={channelName}
              sidechainSources={availableSidechainSources}
            />
          ))}
        </div>

        {/* Add button */}
        <button className="fx-rack-add" onClick={() => setPickerOpen(true)}>
          + ADD
        </button>

        {pickerOpen && (
          <EffectPicker onSelect={addEffect} onClose={() => setPickerOpen(false)} />
        )}
      </div>
    </div>
  );
}
