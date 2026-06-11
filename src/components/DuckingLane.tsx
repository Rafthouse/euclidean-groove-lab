import type { Track, DuckingModule, VoiceId } from '../engine';

/**
 * Ducking module editor. Lives on the kick track today.
 *
 * When the kick fires, the target voice's effective volume is attenuated by
 * up to `amount` and recovers linearly over `decaySteps` 16th-notes. The
 * audio scheduler holds the *only* state (last-trigger marker) and applies
 * the modulation as a *gain* — no timing change, no scheduler restructure.
 *
 * Module contract:
 *   - Visibility gated by `track.ducking?.enabled === true`.
 *   - Toggling never deletes params; just flips `enabled`.
 *   - Target voice is user-selectable; default 'bass'.
 *   - Defaults on first enable: target 'bass', amount 0.6, decay 4 steps.
 */

const DEFAULT_DUCKING: DuckingModule = {
  enabled: true,
  target: 'bass',
  amount: 0.6,
  decaySteps: 4,
};

const TARGETS: ReadonlyArray<{ id: VoiceId; label: string }> = [
  { id: 'bass', label: 'Bass' },
  { id: 'snare', label: 'Snare' },
  { id: 'hat', label: 'Hat' },
  { id: 'kick', label: 'Kick' },
];

interface DuckingLaneProps {
  track: Track;
  onChange: (patch: Partial<Track>) => void;
}

export default function DuckingLane({ track, onChange }: DuckingLaneProps) {
  const ducking = track.ducking;
  const enabled = ducking?.enabled === true;

  const toggle = () => {
    if (enabled) {
      onChange({ ducking: { ...ducking!, enabled: false } });
    } else if (ducking) {
      onChange({ ducking: { ...ducking, enabled: true } });
    } else {
      onChange({ ducking: { ...DEFAULT_DUCKING } });
    }
  };

  const update = (patch: Partial<DuckingModule>) => {
    if (!ducking) return;
    onChange({ ducking: { ...ducking, ...patch } });
  };

  return (
    <div className={'module-lane' + (enabled ? ' is-on' : '')} data-kind="ducking">
      <div className="module-head">
        <button
          type="button"
          className={'toggle' + (enabled ? ' is-on' : '')}
          data-kind="ducking"
          onClick={toggle}
          aria-pressed={enabled}
          aria-label={`Toggle ducking for ${track.name}`}
        >
          ♪ Ducking
        </button>
      </div>

      {enabled && ducking && (
        <div className="module-controls">
          <label className="control">
            <span className="control-label">
              Target
              <b>{TARGETS.find((t) => t.id === ducking.target)?.label ?? ducking.target}</b>
            </span>
            <select
              className="module-select"
              value={ducking.target}
              onChange={(e) => update({ target: e.target.value as VoiceId })}
              aria-label="Ducking target voice"
            >
              {TARGETS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="control">
            <span className="control-label">
              Amount
              <b>{Math.round(ducking.amount * 100)}%</b>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(ducking.amount * 100)}
              onChange={(e) => update({ amount: Number(e.target.value) / 100 })}
            />
          </label>
          <label className="control">
            <span className="control-label">
              Decay
              <b>{ducking.decaySteps} st</b>
            </span>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={ducking.decaySteps}
              onChange={(e) => update({ decaySteps: Number(e.target.value) })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
