import type { Track, RumbleModule } from '../engine';
import Knob from './Knob';

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
        <div className="knob-row">
          <Knob
            label="Amount"
            value={rumble.amount}
            min={0}
            max={100}
            step={1}
            resetValue={DEFAULT_RUMBLE.amount}
            format={(v) => `${v}%`}
            onChange={(v) => update({ amount: v })}
          />
          <Knob
            label="Decay"
            value={rumble.decay}
            min={1}
            max={8}
            step={1}
            sensitivity={120}
            resetValue={DEFAULT_RUMBLE.decay}
            format={(v) => `${v} st`}
            onChange={(v) => update({ decay: v })}
          />
          <Knob
            label="Tone"
            value={rumble.toneHz}
            min={20}
            max={200}
            step={1}
            resetValue={DEFAULT_RUMBLE.toneHz}
            format={(v) => `${v} Hz`}
            onChange={(v) => update({ toneHz: v })}
          />
          <Knob
            label="LP Filter"
            value={rumble.lpHz}
            min={20}
            max={500}
            step={1}
            resetValue={DEFAULT_RUMBLE.lpHz}
            format={(v) => `${v} Hz`}
            onChange={(v) => update({ lpHz: v })}
          />
        </div>
      )}
    </div>
  );
}
