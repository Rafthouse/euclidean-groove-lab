import { useReducer } from 'react';
import type { Track } from '../engine';
import { resolvePitchSpec, midiToNoteName, pitchSequenceToText, parseNoteSequence } from '../engine';
import { laneReducer, initLaneState, pitchesFromText, PITCH_STARTER } from './pitchLaneState';

/**
 * Pitch module editor (Variant B). Universal component; TrackCard decides
 * which voices expose it.
 *
 * Module contract:
 *   - Visibility is gated by `track.pitchEnabled` (default false). The toggle
 *     button flips that flag — it never clears `track.pitches`.
 *   - On first enable, if no pitches exist yet, seed PITCH_STARTER so the
 *     editor opens with an audible default (req. "Default Hat velocity = [100]
 *     if empty" — same principle for Pitch).
 *   - Disabling preserves both `track.pitches` and the editor's text.
 */

interface PitchLaneProps {
  track: Track;
  onChange: (patch: Partial<Track>) => void;
}

export default function PitchLane({ track, onChange }: PitchLaneProps) {
  const open = track.pitchEnabled === true;

  const [state, dispatch] = useReducer(laneReducer, undefined, () =>
    initLaneState(track.pitches ? pitchSequenceToText(track.pitches) : PITCH_STARTER),
  );

  // Text edits write the data patch but never touch the enabled flag.
  const setText = (text: string) => {
    dispatch({ type: 'setText', text });
    onChange({ pitches: pitchesFromText(track.id, text) });
  };

  // Toggle is the ONLY control over the module's enabled flag. Data is
  // preserved across toggles — req. (3) "Toggling MUST NOT reset stored
  // pattern data". On first enable, seed a default if the track has no
  // pitches yet.
  const toggle = () => {
    if (open) {
      onChange({ pitchEnabled: false });
    } else {
      const patch: Partial<Track> = { pitchEnabled: true };
      if (!track.pitches || track.pitches.slots.length === 0) {
        patch.pitches = pitchesFromText(track.id, PITCH_STARTER);
      }
      onChange(patch);
    }
  };

  // Contour: one bar per slot, height normalized to the sequence's own range so
  // the shape is visible even within a narrow span. Rests render as empty slots.
  const midis = track.pitches
    ? track.pitches.slots.map((s) => (s ? resolvePitchSpec(s.pitch) : null))
    : [];
  const present = midis.filter((m): m is number => m !== null);
  const lo = present.length ? Math.min(...present) : 0;
  const hi = present.length ? Math.max(...present) : 1;
  const span = Math.max(1, hi - lo);

  const { errors } = parseNoteSequence(state.text);

  return (
    <div className={'pitch-lane' + (open ? ' is-on' : '')}>
      <div className="pitch-head">
        <button
          type="button"
          className={'toggle' + (open ? ' is-on' : '')}
          data-kind="pitch"
          onClick={toggle}
          aria-pressed={open}
          aria-label={`Toggle pitch layer for ${track.name}`}
        >
          ♪ Pitch
        </button>
        {open && (
          <span className="pitch-count">
            {midis.length} {midis.length === 1 ? 'note' : 'notes'}
          </span>
        )}
      </div>

      {open && (
        <>
          <div className="pitch-contour" aria-hidden="true">
            {midis.map((m, i) => (
              <div
                key={i}
                className={'pitch-bar' + (m === null ? ' is-rest' : '')}
                style={m === null ? undefined : { height: `${15 + 85 * ((m - lo) / span)}%` }}
                title={m === null ? 'rest' : midiToNoteName(m)}
              />
            ))}
          </div>
          <input
            className={'pitch-input' + (errors.length ? ' has-error' : '')}
            type="text"
            value={state.text}
            spellCheck={false}
            placeholder="C3 D3 G3 Bb3  ·  60 62 67 70  ·  - = rest"
            onChange={(e) => setText(e.target.value)}
            aria-label={`Pitch sequence for ${track.name}`}
          />
        </>
      )}
    </div>
  );
}
