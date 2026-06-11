import { useReducer } from 'react';
import type { Track } from '../engine';
import { resolvePitchSpec, midiToNoteName, pitchSequenceToText, parseNoteSequence } from '../engine';
import { laneReducer, initLaneState, pitchesFromText } from './pitchLaneState';

/**
 * Variant B Pitch Lane. First version: TEXT INPUT for editing, with a bar
 * contour as read-only visualization of the melodic shape. Drag editing is a
 * deliberate later commit (see docs/DESIGN-PITCH-UI.md).
 *
 * Open/closed is a UI state (LaneState.open) controlled ONLY by the ♪ toggle.
 * Clearing the text makes `track.pitches` undefined but keeps the lane open, so
 * "select-all → delete → retype" works without the field disappearing.
 */

interface PitchLaneProps {
  track: Track;
  onChange: (patch: Partial<Track>) => void;
}

export default function PitchLane({ track, onChange }: PitchLaneProps) {
  const [state, dispatch] = useReducer(laneReducer, undefined, () =>
    initLaneState(track.pitches ? pitchSequenceToText(track.pitches) : '', !!track.pitches),
  );

  // Text edits update local text + the data patch, but never the open state.
  const setText = (text: string) => {
    dispatch({ type: 'setText', text });
    onChange({ pitches: pitchesFromText(track.id, text) });
  };

  // The toggle is the ONLY control over open/closed.
  const toggle = () => {
    dispatch({ type: 'toggle' });
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
    <div className={'pitch-lane' + (state.open ? ' is-on' : '')}>
      <div className="pitch-head">
        <button
          type="button"
          className={'toggle' + (state.open ? ' is-on' : '')}
          data-kind="pitch"
          onClick={toggle}
          aria-pressed={state.open}
          aria-label={`Toggle pitch layer for ${track.name}`}
        >
          ♪ Pitch
        </button>
        {state.open && (
          <span className="pitch-count">
            {midis.length} {midis.length === 1 ? 'note' : 'notes'}
          </span>
        )}
      </div>

      {state.open && (
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
