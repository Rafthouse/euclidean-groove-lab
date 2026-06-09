import type { CSSProperties } from 'react';
import Sequencer from './Sequencer';
import PitchLane from './PitchLane';
import { trackPattern, onsetCount, density, isPitchedVoice } from '../engine';
import type { Track } from '../engine';

interface TrackCardProps {
  track: Track;
  currentStep: number; // -1 when stopped; otherwise the GLOBAL step
  onChange: (patch: Partial<Track>) => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
}

export default function TrackCard({
  track,
  currentStep,
  onChange,
  onToggleMute,
  onToggleSolo,
}: TrackCardProps) {
  const pattern = trackPattern(track).pulses;
  const style = { ['--track-color' as string]: track.color } as CSSProperties;

  const cardClass =
    'track-card' +
    (track.mute ? ' is-muted' : '') +
    (track.solo ? ' is-solo' : '');

  return (
    <div className={cardClass} style={style}>
      <div className="track-head">
        <span className="track-name">{track.name}</span>
        <div className="track-toggles">
          <button
            type="button"
            data-kind="mute"
            className={'toggle' + (track.mute ? ' is-on' : '')}
            onClick={onToggleMute}
            aria-pressed={track.mute}
            aria-label={`Mute ${track.name}`}
          >
            M
          </button>
          <button
            type="button"
            data-kind="solo"
            className={'toggle' + (track.solo ? ' is-on' : '')}
            onClick={onToggleSolo}
            aria-pressed={track.solo}
            aria-label={`Solo ${track.name}`}
          >
            S
          </button>
        </div>
      </div>

      <Sequencer pattern={pattern} currentStep={currentStep} />

      {isPitchedVoice(track.voiceId) && (
        <PitchLane track={track} onChange={onChange} />
      )}

      <div className="controls">
        <Slider
          label="Steps"
          value={track.steps}
          min={2}
          max={32}
          onChange={(v) => onChange({ steps: v })}
        />
        <Slider
          label="Hits"
          value={track.hits}
          min={0}
          max={track.steps}
          onChange={(v) => onChange({ hits: v })}
        />
        <Slider
          label="Rotation"
          value={track.rotation}
          min={0}
          max={Math.max(0, track.steps - 1)}
          onChange={(v) => onChange({ rotation: v })}
        />
        <Slider
          label="Volume"
          value={track.volume ?? 100}
          min={0}
          max={100}
          onChange={(v) => onChange({ volume: v })}
        />
      </div>

      <div className="mini-metrics">
        <div className="mini-axis">
          <b>
            {onsetCount(pattern)}/{track.steps}
          </b>
          <span>Onsets</span>
        </div>
        <div className="mini-axis">
          <b>{Math.round(density(pattern) * 100)}%</b>
          <span>Density</span>
        </div>
      </div>
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, onChange }: SliderProps) {
  return (
    <label className="control">
      <span className="control-label">
        {label}
        <b>{value}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
