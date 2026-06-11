import type { Track, GhostModule } from '../engine';
import Knob from './Knob';

/**
 * MIDI Ghost Delay module editor (Snare). Knob-based, compact.
 *
 * The ghost is a SEPARATE audio lane in audio.ts — its own Tone.Player routed
 * through an HP→LP filter chain — so it never shares the main snare voice or
 * envelope. This editor writes ONLY to `track.ghost`; it never touches
 * `track.velocity` (the main note).
 *
 * Module contract:
 *   - Visibility gated by `track.ghost?.enabled === true`.
 *   - Toggling never deletes params; just flips `enabled`.
 *   - Defaults on first enable below.
 */

const DEFAULT_GHOST: GhostModule = {
  enabled: true,
  amount: 55,
  delaySteps: 1,
  probability: 0.5,
  hpHz: 200,
  lpHz: 6000,
};

interface GhostLaneProps {
  track: Track;
  onChange: (patch: Partial<Track>) => void;
}

export default function GhostLane({ track, onChange }: GhostLaneProps) {
  const ghost = track.ghost;
  const enabled = ghost?.enabled === true;

  const toggle = () => {
    if (enabled) {
      onChange({ ghost: { ...ghost!, enabled: false } });
    } else if (ghost) {
      onChange({ ghost: { ...ghost, enabled: true } });
    } else {
      onChange({ ghost: { ...DEFAULT_GHOST } });
    }
  };

  const update = (patch: Partial<GhostModule>) => {
    if (!ghost) return;
    onChange({ ghost: { ...ghost, ...patch } });
  };

  return (
    <div className={'module-lane' + (enabled ? ' is-on' : '')} data-kind="ghost">
      <div className="module-head">
        <button
          type="button"
          className={'toggle' + (enabled ? ' is-on' : '')}
          data-kind="ghost"
          onClick={toggle}
          aria-pressed={enabled}
          aria-label={`Toggle ghost delay for ${track.name}`}
        >
          ♪ Ghost
        </button>
      </div>

      {enabled && ghost && (
        <div className="knob-row">
          <Knob
            label="Amount"
            value={ghost.amount}
            min={0}
            max={100}
            format={(v) => `${v}%`}
            onChange={(v) => update({ amount: v })}
          />
          <Knob
            label="Delay"
            value={ghost.delaySteps}
            min={1}
            max={4}
            step={1}
            sensitivity={120}
            format={(v) => `${v} st`}
            onChange={(v) => update({ delaySteps: v })}
          />
          <Knob
            label="Prob"
            value={Math.round(ghost.probability * 100)}
            min={0}
            max={100}
            format={(v) => `${v}%`}
            onChange={(v) => update({ probability: v / 100 })}
          />
          <Knob
            label="HP"
            value={ghost.hpHz}
            min={20}
            max={2000}
            step={10}
            format={(v) => `${v}`}
            onChange={(v) => update({ hpHz: v })}
          />
          <Knob
            label="LP"
            value={ghost.lpHz}
            min={1000}
            max={16000}
            step={100}
            format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)}
            onChange={(v) => update({ lpHz: v })}
          />
        </div>
      )}
    </div>
  );
}
