import Sequencer from './Sequencer';
import PitchLane from './PitchLane';
import VelocityLane from './VelocityLane';
import GhostLane from './GhostLane';
import DuckingLane from './DuckingLane';
import Knob from './Knob';
import { trackPattern, onsetCount, density, PATTERN_SLOT_COUNT } from '../engine';
import type { Track, PlaybackMode, PlaybackSpeed } from '../engine';

// Per-voice module assignment. Adding a module to another voice is a one-line
// change here — engine/UI are universal, gating is purely presentational.
const VELOCITY_EDITOR_VOICES: ReadonlyArray<Track['voiceId']> = ['hat'];
const PITCH_EDITOR_VOICES: ReadonlyArray<Track['voiceId']> = ['bass'];
const GHOST_EDITOR_VOICES: ReadonlyArray<Track['voiceId']> = ['snare'];
// Ducking module is currently DISABLED (per bug-fix requirement). Type and
// component preserved so the lane can be revived later by adding the voice
// back to this list; for now no voice exposes it.
const DUCKING_EDITOR_VOICES: ReadonlyArray<Track['voiceId']> = [];

interface TrackCardProps {
  track: Track;
  currentStep: number; // -1 when stopped; otherwise the GLOBAL step
  onChange: (patch: Partial<Track>) => void;
  onSwitchPattern: (slot: number) => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
}

export default function TrackCard({
  track,
  currentStep,
  onChange,
  onSwitchPattern,
  onToggleMute,
  onToggleSolo,
}: TrackCardProps) {
  const { pulses: pattern, mutedStepMask } = trackPattern(track);
  // --track-color is sourced from CSS by voice (`[data-voice]`), so it follows
  // the active theme (dark neon vs vintage paper) instead of a fixed data color.

  // Local step (for the mask row's playhead echo). The pattern is generator-
  // driven — there is NO manual step authoring; the rhythm comes from the
  // Euclidean params, and the mask is a mute overlay edited via the ring or mask row.
  const localStep = currentStep >= 0 && track.steps > 0 ? currentStep % track.steps : -1;

  // Toggle the manual mute overlay for a generated onset.
  //
  // The mask is ONSET-indexed: index 0 = first Euclidean hit, index 1 = second,
  // etc., regardless of rotation. The ring calls toggleStep(step) where `step`
  // is the STEP position; we convert to onset index here so the engine contract
  // stays correct. Rotating the pattern never changes which event is muted.
  const toggleStep = (step: number) => {
    if (!pattern[step]) return; // step is a rest — nothing to mute
    let onsetIndex = 0;
    for (let i = 0; i < step; i++) {
      if (pattern[i]) onsetIndex++;
    }
    const numOnsets = track.hits;
    const current =
      track.manualMute && track.manualMute.length === numOnsets
        ? [...track.manualMute]
        : new Array<boolean>(numOnsets).fill(false);
    current[onsetIndex] = !current[onsetIndex];
    onChange({ manualMute: current.some(Boolean) ? current : undefined });
  };

  const activeSlot = track.activePattern ?? 0;

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

      <PatternBank
        track={track}
        activeSlot={activeSlot}
        onSwitchPattern={onSwitchPattern}
      />

      <Sequencer
        pattern={pattern}
        mutedSteps={mutedStepMask}
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

      <div className="knob-row" data-role="params">
        <Knob
          label="Steps"
          value={track.steps}
          min={2}
          max={32}
          step={1}
          onChange={(v) => onChange({ steps: v })}
        />
        <Knob
          label="Hits"
          value={track.hits}
          min={0}
          max={track.steps}
          step={1}
          onChange={(v) => onChange({ hits: v })}
        />
        <Knob
          label="Vol"
          value={track.volume ?? 100}
          min={0}
          max={100}
          step={1}
          format={(v) => `${v}%`}
          onChange={(v) => onChange({ volume: v })}
        />
        <Knob
          label="Rot"
          value={track.rotation}
          min={0}
          max={Math.max(1, track.steps - 1)}
          step={1}
          onChange={(v) => onChange({ rotation: v })}
        />
      </div>

      <MaskRow
        pattern={pattern}
        mutedSteps={mutedStepMask}
        localStep={localStep}
        onToggleStep={toggleStep}
      />

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

interface PatternBankProps {
  track: Track;
  activeSlot: number;
  onSwitchPattern: (slot: number) => void;
}

/**
 * Pattern bank selector — 12 slots labelled A–L. The active slot is the live
 * working copy; other slots show as "stored" once they hold a snapshot. Clicking
 * a slot saves the current generator state and loads the target (handled by the
 * pure `switchTrackPattern` in the engine, via App).
 */
function PatternBank({ track, activeSlot, onSwitchPattern }: PatternBankProps) {
  return (
    <div className="pattern-bank" role="tablist" aria-label={`${track.name} pattern bank`}>
      {Array.from({ length: PATTERN_SLOT_COUNT }, (_, i) => {
        const letter = String.fromCharCode(65 + i);
        const isActive = i === activeSlot;
        const stored = isActive || !!track.patterns?.[i];
        return (
          <button
            key={i}
            type="button"
            role="tab"
            className={
              'pattern-slot' +
              (isActive ? ' is-active' : '') +
              (stored ? ' is-stored' : '')
            }
            aria-selected={isActive}
            aria-label={`Pattern ${letter}${isActive ? ' (active)' : ''}`}
            onClick={() => onSwitchPattern(i)}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}

interface MaskRowProps {
  pattern: boolean[];
  mutedSteps?: boolean[];
  localStep: number;
  onToggleStep: (step: number) => void;
}

/**
 * Mask step toggles — one cell per step. Onset cells are clickable to mute /
 * unmute the generated hit; rest cells are inert positional markers (there is
 * nothing to mute). This is the ONLY place the mask is authored — the ring is
 * pure visualisation. The mask never changes generation, only suppresses output.
 */
function MaskRow({ pattern, mutedSteps, localStep, onToggleStep }: MaskRowProps) {
  return (
    <div className="mask-lane">
      <span className="mask-label">Mask</span>
      <div className="mask-row" role="group" aria-label="Step mask">
        {pattern.map((on, i) => {
          const muted = on && !!mutedSteps?.[i];
          const classes =
            'mask-cell ' +
            (on ? 'onset' : 'rest') +
            (muted ? ' muted' : '') +
            (i === localStep ? ' is-current' : '');
          return (
            <button
              key={i}
              type="button"
              className={classes}
              disabled={!on}
              aria-pressed={on ? muted : undefined}
              aria-label={
                on
                  ? `${muted ? 'Unmute' : 'Mute'} step ${i + 1}`
                  : `Step ${i + 1} (rest)`
              }
              onClick={on ? () => onToggleStep(i) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

