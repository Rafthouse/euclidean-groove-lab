import Sequencer from './Sequencer';
import PitchLane from './PitchLane';
import VelocityLane from './VelocityLane';
import GhostLane from './GhostLane';
import DuckingLane from './DuckingLane';
import { trackPattern, onsetCount, density } from '../engine';
import type { Track, PlaybackMode, PlaybackSpeed } from '../engine';

// Per-voice module assignment. Adding a module to another voice is a one-line
// change here — engine/UI are universal, gating is purely presentational.
const VELOCITY_EDITOR_VOICES: ReadonlyArray<Track['voiceId']> = ['hat'];
const PITCH_EDITOR_VOICES: ReadonlyArray<Track['voiceId']> = ['bass'];
const GHOST_EDITOR_VOICES: ReadonlyArray<Track['voiceId']> = ['snare'];
const DUCKING_EDITOR_VOICES: ReadonlyArray<Track['voiceId']> = ['kick'];

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
  // --track-color is sourced from CSS by voice (`[data-voice]`), so it follows
  // the active theme (dark neon vs vintage paper) instead of a fixed data color.

  // Toggle the manual mute overlay for a single generated onset. The mask is
  // step-indexed and kept the same length as the pattern; an all-false mask
  // collapses back to undefined so "no overrides" stays the clean default.
  const toggleStep = (step: number) => {
    const mask =
      track.manualMute && track.manualMute.length === track.steps
        ? [...track.manualMute]
        : new Array<boolean>(track.steps).fill(false);
    mask[step] = !mask[step];
    onChange({ manualMute: mask.some(Boolean) ? mask : undefined });
  };

  const cardClass =
    'track-card' +
    (track.mute ? ' is-muted' : '') +
    (track.solo ? ' is-solo' : '');

  return (
    <div className={cardClass} data-voice={track.voiceId}>
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

      <Sequencer
        pattern={pattern}
        mutedSteps={track.manualMute}
        currentStep={currentStep}
        onToggleStep={toggleStep}
      />

      {PITCH_EDITOR_VOICES.includes(track.voiceId) && (
        <PitchLane track={track} onChange={onChange} />
      )}

      {VELOCITY_EDITOR_VOICES.includes(track.voiceId) && (
        <VelocityLane track={track} onChange={onChange} />
      )}

      {GHOST_EDITOR_VOICES.includes(track.voiceId) && (
        <GhostLane track={track} onChange={onChange} />
      )}

      {DUCKING_EDITOR_VOICES.includes(track.voiceId) && (
        <DuckingLane track={track} onChange={onChange} />
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

      <div className="playback-controls">
        <label className="playback-select">
          <span>Mode</span>
          <select
            value={track.playbackMode ?? 'forward'}
            onChange={(e) => onChange({ playbackMode: e.target.value as PlaybackMode })}
            aria-label={`Playback mode for ${track.name}`}
          >
            <option value="forward">▶ Forward</option>
            <option value="reverse">◀ Reverse</option>
            <option value="pendulum">↔ Pendulum</option>
          </select>
        </label>
        <label className="playback-select">
          <span>Speed</span>
          <select
            value={String(track.playbackSpeed ?? 1)}
            onChange={(e) => onChange({ playbackSpeed: Number(e.target.value) as PlaybackSpeed })}
            aria-label={`Playback speed for ${track.name}`}
          >
            <option value="0.5">½×</option>
            <option value="1">1×</option>
            <option value="2">2×</option>
          </select>
        </label>
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
