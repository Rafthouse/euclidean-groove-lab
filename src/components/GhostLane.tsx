import type { Track, GhostModule } from '../engine';

/**
 * MIDI Ghost Delay module editor. Lives on the snare track today.
 *
 * Schedules a duplicate of every main snare hit, `delaySteps` 16th-notes later,
 * with `probability` chance, at `velocity`% of full. The audio scheduler reads
 * `track.ghost` and runs the duplicate on the SAME Tone.Transport — there is
 * no second timer.
 *
 * Module contract:
 *   - Visibility gated by `track.ghost?.enabled === true`.
 *   - Toggling never deletes params; just flips `enabled`.
 *   - Defaults on first enable: delay 1 step, 50% probability, 60% velocity.
 */

const DEFAULT_GHOST: GhostModule = {
  enabled: true,
  delaySteps: 1,
  probability: 0.5,
  velocity: 60,
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
        <div className="module-controls">
          <label className="control">
            <span className="control-label">
              Delay
              <b>{ghost.delaySteps} st</b>
            </span>
            <input
              type="range"
              min={1}
              max={4}
              step={1}
              value={ghost.delaySteps}
              onChange={(e) => update({ delaySteps: Number(e.target.value) })}
            />
          </label>
          <label className="control">
            <span className="control-label">
              Probability
              <b>{Math.round(ghost.probability * 100)}%</b>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(ghost.probability * 100)}
              onChange={(e) => update({ probability: Number(e.target.value) / 100 })}
            />
          </label>
          <label className="control">
            <span className="control-label">
              Velocity
              <b>{ghost.velocity}</b>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={ghost.velocity}
              onChange={(e) => update({ velocity: Number(e.target.value) })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
