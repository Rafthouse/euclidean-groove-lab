/**
 * FX Rack Panel — clean effect list.
 *
 * Modern workflow:
 *   - Clean list of effects with enable/disable, delete, move up/down
 *   - Each effect has an "Open Editor" button → dedicated full editor
 *   - No inline controls, no miniature sliders, no duplicated UI
 *   - Effects with dedicated modules: Compressor, SHCHUR EQ
 *   - Effects without dedicated modules: open in a simple all-params editor
 */

import React, { useCallback, useState } from 'react';
import type { FxSlot, BuiltInEffectType, FxParams, EqParams, Eq2Params, CompressorParams, DelayParams, ReverbParams, ChorusParams, DistortionParams, FilterParams, LimiterParams, StereoWidthParams, GateParams } from './fxTypes';
import { FX_TYPE_NAMES, createFxSlot } from './fxTypes';
import CompressorModule from '../compressor/CompressorModule';
import EqModule from '../eq/EqModule';

// ── Props ─────────────────────────────────────────────────────────────

interface FxRackPanelProps {
  channelName: string;
  channelId: string;
  fxChain: FxSlot[];
  onUpdateChain: (channelId: string, chain: FxSlot[]) => void;
  onClose: () => void;
  availableSidechainSources?: string[];
}

// ── Effect Picker ─────────────────────────────────────────────────────

const AVAILABLE_EFFECTS: BuiltInEffectType[] = [
  'eq2', 'eq', 'compressor', 'delay', 'reverb', 'chorus',
  'distortion', 'filter', 'limiter', 'stereoWidth', 'gate',
];

function EffectPicker({ onSelect, onClose }: {
  onSelect: (type: BuiltInEffectType) => void;
  onClose: () => void;
}) {
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

// ── Universal Param Editor (fallback for effects without a dedicated UI) ──

function UniversalEditor({ params, onChange, onClose, type, channelName }: {
  params: FxParams;
  onChange: (p: FxParams) => void;
  onClose: () => void;
  type: BuiltInEffectType;
  channelName: string;
}) {
  const p = params as any;

  return (
    <div className="fx-rack-overlay" onClick={onClose}>
      <div className="fx-rack-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="fx-rack-header">
          <span className="fx-rack-title">{FX_TYPE_NAMES[type]}: {channelName}</span>
          <button className="fx-rack-close" onClick={onClose}>✕</button>
        </div>
        <div className="fx-param-grid">
          {Object.keys(p).map((key) => {
            if (typeof p[key] !== 'number') return null;
            // Determine range from reasonable defaults
            const isDb = key.includes('threshold') || key.includes('makeup') || key.includes('gain');
            const isTime = key.includes('attack') || key.includes('release') || key.includes('time');
            const isMix = key.includes('mix') || key.includes('dry') || key.includes('wet') || key.includes('depth') || key.includes('feedback');
            const isFreq = key.includes('freq') || key === 'frequency';
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
              <React.Fragment key={key}>
                <label style={{ textTransform: 'capitalize', fontSize: 10 }}>
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                  <input type="range" min={min} max={max} step={step}
                    value={p[key]} onChange={(e) => onChange({ ...p, [key]: Number(e.target.value) })} />
                </label>
                <span className="fx-param-value">{display}</span>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Dedicated Editor Router ───────────────────────────────────────────

type EditorType = 'none' | 'eq2' | 'compressor';

function openEditorFor(type: BuiltInEffectType): EditorType {
  if (type === 'eq2') return 'eq2';
  if (type === 'compressor') return 'compressor';
  return 'none';
}

function EditorOverlay({ type, params, onChange, onClose, channelName, sidechainSources }: {
  type: BuiltInEffectType;
  params: FxParams;
  onChange: (p: FxParams) => void;
  onClose: () => void;
  channelName: string;
  sidechainSources?: string[];
}) {
  const editor = openEditorFor(type);

  switch (editor) {
    case 'eq2':
      return (
        <EqModule
          params={params as Eq2Params}
          onChange={onChange}
          onClose={onClose}
          channelName={channelName}
        />
      );
    case 'compressor':
      return (
        <CompressorModule
          params={params as CompressorParams}
          onChange={onChange}
          onClose={onClose}
          channelName={channelName}
          sidechainSources={sidechainSources ?? []}
        />
      );
    default:
      return (
        <UniversalEditor
          params={params}
          onChange={onChange}
          onClose={onClose}
          type={type}
          channelName={channelName}
        />
      );
  }
}

// ── Slot Row (clean — no inline controls) ─────────────────────────────

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
  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <>
      <div className={`fx-slot${!slot.enabled ? ' fx-slot-disabled' : ''}`}>
        <div className="fx-slot-header">
          <div className="fx-slot-controls">
            <button
              className="fx-slot-toggle"
              onClick={onToggle}
              title={slot.enabled ? 'Disable' : 'Enable'}
            >
              {slot.enabled ? '●' : '○'}
            </button>
            <span className="fx-slot-number">{index + 1}.</span>
            <span className="fx-slot-name">{FX_TYPE_NAMES[slot.type]}</span>
          </div>
          <div className="fx-slot-actions">
            <button className="fx-slot-edit" onClick={() => setEditorOpen(true)} title="Open Editor">
              ◉ Open
            </button>
            <button className="fx-slot-move" onClick={onMoveUp} disabled={index === 0} title="Move up">▲</button>
            <button className="fx-slot-move" onClick={onMoveDown} disabled={index === total - 1} title="Move down">▼</button>
            <button className="fx-slot-remove" onClick={onRemove} title="Remove">✕</button>
          </div>
        </div>
      </div>
      {editorOpen && (
        <EditorOverlay
          type={slot.type}
          params={slot.params}
          onChange={onParamsChange}
          onClose={() => setEditorOpen(false)}
          channelName={slotChannelName}
          sidechainSources={sidechainSources}
        />
      )}
    </>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────

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
