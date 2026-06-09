import { useState } from 'react';
import type { Track } from '../engine';
import { parseNoteSequence, pitchSequenceToText, resolvePitchSpec, midiToNoteName } from '../engine';

/**
 * Variant B Pitch Lane. First version: TEXT INPUT for editing, with a bar
 * contour as read-only visualization of the melodic shape. Drag editing is a
 * deliberate later commit (see docs/DESIGN-PITCH-UI.md).
 *
 * The lane is universal — available on any track. Pitch is onset-indexed and
 * independent in length from the rhythm, so a sequence shorter or longer than
 * the onset count drifts (isorhythm) and you hear it on Play.
 */

const STARTER = 'C3 D3 G3 Bb3';

interface PitchLaneProps {
  track: Track;
  onChange: (patch: Partial<Track>) => void;
}

export default function PitchLane({ track, onChange }: PitchLaneProps) {
  const enabled = !!track.pitches;
  const [text, setText] = useState(() =>
    track.pitches ? pitchSequenceToText(track.pitches) : '',
  );

  // Parse on every change; the model stores MidiNote, the text box keeps the
  // raw string so partial/invalid input is never clobbered mid-typing.
  const commit = (value: string) => {
    setText(value);
    const { slots } = parseNoteSequence(value);
    onChange({
      pitches: slots.length === 0 ? undefined : { id: `${track.id}-pitch`, slots },
    });
  };

  const toggle = () => {
    if (enabled) {
      setText('');
      onChange({ pitches: undefined });
    } else {
      commit(STARTER);
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

  const { errors } = parseNoteSequence(text);

  return (
    <div className={'pitch-lane' + (enabled ? ' is-on' : '')}>
      <div className="pitch-head">
        <button
          type="button"
          className={'toggle' + (enabled ? ' is-on' : '')}
          data-kind="pitch"
          onClick={toggle}
          aria-pressed={enabled}
          aria-label={`Toggle pitch layer for ${track.name}`}
        >
          ♪ Pitch
        </button>
        {enabled && (
          <span className="pitch-count">
            {midis.length} {midis.length === 1 ? 'note' : 'notes'}
          </span>
        )}
      </div>

      {enabled && (
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
            value={text}
            spellCheck={false}
            placeholder="C3 D3 G3 Bb3  ·  60 62 67 70  ·  - = rest"
            onChange={(e) => commit(e.target.value)}
            aria-label={`Pitch sequence for ${track.name}`}
          />
        </>
      )}
    </div>
  );
}
