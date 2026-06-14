import type { Track, RumbleModule } from '../engine';

const DEFAULT_RUMBLE: RumbleModule = {
  enabled: true,
  amount: 60,
  hits: 2,
  decay: 4,
  toneHz: 55,
  lpHz: 120,
};

interface RumbleLaneProps {
  track: Track;
  onChange: (patch: Partial<Track>) => void;
}

export default function RumbleLane({ track, onChange }: RumbleLaneProps) {
  const rumble = track.rumble;
  const enabled = rumble?.enabled === true;

  const toggle = () => {
    if (enabled) {
      onChange({ rumble: { ...rumble!, enabled: false } });
    } else if (rumble) {
      onChange({ rumble: { ...rumble, enabled: true } });
    } else {
      onChange({ rumble: { ...DEFAULT_RUMBLE } });
    }
  };

  const update = (patch: Partial<RumbleModule>) => {
    if (!rumble) return;
    onChange({ rumble: { ...rumble, ...patch } });
  };

  return (
    <div className={'module-lane' + (enabled ? ' is-on' : '')} data-kind="rumble">
      <div className="module-head">
        <button
          type="button"
          className={'toggle' + (enabled ? ' is-on' : '')}
          data-kind="rumble"
          onClick={toggle}
          aria-pressed={enabled}
          aria-label={`Toggle sub-bass rumble for ${track.name}`}
        >
          ◎ Rumble
        </button>
      </div>

      {enabled && rumble && (
        <div className="module-controls">
          <label className="control">
            <span className="control-label">
              Amount
              <b>{rumble.amount}%</b>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={rumble.amount}
              onChange={(e) => update({ amount: Number(e.target.value) })}
            />
          </label>
          <label className="control">
            <span className="control-label">
              Hits
              <b>{rumble.hits}</b>
            </span>
            <input
              type="range"
              min={1}
              max={4}
              step={1}
              value={rumble.hits}
              onChange={(e) => update({ hits: Number(e.target.value) })}
            />
          </label>
          <label className="control">
            <span className="control-label">
              Decay
              <b>{rumble.decay} st</b>
            </span>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={rumble.decay}
              onChange={(e) => update({ decay: Number(e.target.value) })}
            />
          </label>
          <label className="control">
            <span className="control-label">
              Tone
              <b>{rumble.toneHz} Hz</b>
            </span>
            <input
              type="range"
              min={20}
              max={200}
              step={1}
              value={rumble.toneHz}
              onChange={(e) => update({ toneHz: Number(e.target.value) })}
            />
          </label>
          <label className="control">
            <span className="control-label">
              LP Filter
              <b>{rumble.lpHz} Hz</b>
            </span>
            <input
              type="range"
              min={20}
              max={500}
              step={1}
              value={rumble.lpHz}
              onChange={(e) => update({ lpHz: Number(e.target.value) })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
