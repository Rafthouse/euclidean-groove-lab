import type { Track, GhostModule } from '../engine';

/**
 * MIDI Ghost Delay module editor. Lives on the snare track today.
 *
 * Schedules a duplicate of every main snare hit, `delaySteps` 16th-notes later,
 * with `probability` chance, using a per-onset-cycled velocity pattern stored
 * IN THIS MODULE (`ghost.velocity: number[]`). The pattern is GHOST ONLY —
 * the audio scheduler reads it via `track.ghost.velocity[onsetIdx % len]`
 * and the editor below writes to `track.ghost.velocity` exclusively. Neither
 * side ever touches `track.velocity` (which belongs to the main note).
 *
 * Module contract:
 *   - Visibility gated by `track.ghost?.enabled === true`.
 *   - Toggling never deletes params; just flips `enabled`.
 *   - Defaults on first enable: delay 1 step, 50% probability, velocity [60].
 */

const DEFAULT_GHOST: GhostModule = {
  enabled: true,
  delaySteps: 1,
  probability: 0.5,
  velocity: [60],
};

interface GhostLaneProps {
  track: Track;
  onChange: (patch: Partial<Track>) => void;
}

export default function GhostLane({ track, onChange }: GhostLaneProps) {
  const ghost = track.ghost;
  const enabled = ghost?.enabled === true;
  const ghostVel = ghost?.velocity ?? [];

  const toggle = () => {
    if (enabled) {
      onChange({ ghost: { ...ghost!, enabled: false } });
    } else if (ghost) {
      // Re-enable preserving prior data; if velocity array somehow empty, seed it.
      const velocity = ghost.velocity.length > 0 ? ghost.velocity : [...DEFAULT_GHOST.velocity];
      onChange({ ghost: { ...ghost, enabled: true, velocity } });
    } else {
      onChange({ ghost: { ...DEFAULT_GHOST, velocity: [...DEFAULT_GHOST.velocity] } });
    }
  };

  const update = (patch: Partial<GhostModule>) => {
    if (!ghost) return;
    onChange({ ghost: { ...ghost, ...patch } });
  };

  const setVelocityAt = (i: number, v: number) => {
    if (!ghost) return;
    const next = ghost.velocity.slice();
    next[i] = Math.max(0, Math.min(100, Math.round(v)));
    update({ velocity: next });
  };

  const addPoint = () => {
    if (!ghost) return;
    const last = ghost.velocity[ghost.velocity.length - 1] ?? 60;
    update({ velocity: [...ghost.velocity, last] });
  };

  const removePoint = () => {
    if (!ghost || ghost.velocity.length <= 1) return;
    update({ velocity: ghost.velocity.slice(0, -1) });
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
        {enabled && (
          <span className="velocity-count" style={{ marginLeft: 'auto' }}>
            {ghostVel.length} {ghostVel.length === 1 ? 'pt' : 'pts'}
          </span>
        )}
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
          <div className="control">
            <span className="control-label">
              <span>Velocity</span>
              <span style={{ display: 'inline-flex', gap: 4 }}>
                <button
                  type="button"
                  className="velocity-step"
                  onClick={removePoint}
                  disabled={ghostVel.length <= 1}
                  aria-label="Remove last ghost velocity point"
                  title="Remove last point"
                >−</button>
                <button
                  type="button"
                  className="velocity-step"
                  onClick={addPoint}
                  aria-label="Add a ghost velocity point"
                  title="Add a point at the end"
                >+</button>
              </span>
            </span>
            <div className="ghost-vel-grid">
              {ghostVel.map((v, i) => (
                <label key={i} className="ghost-vel-cell">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={v}
                    onChange={(e) => setVelocityAt(i, Number(e.target.value))}
                    aria-label={`Ghost velocity ${i + 1}`}
                  />
                  <b>{v}</b>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
