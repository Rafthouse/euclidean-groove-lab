import { useReducer, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Track } from '../engine';
import {
  velocityLaneReducer,
  initVelocityLaneState,
  paintBar,
  pointerToBarValue,
} from './velocityLaneState';

/**
 * Variant of the per-track editor for the velocity layer. Mirrors PitchLane's
 * shape but the input is a CROSS-BAR DRAG instead of a text field — closer to
 * an FL-Studio piano-roll feel: press, drag, draw a curve in one stroke.
 *
 * The velocity sequence is its own cycle, INDEPENDENT in length from both the
 * rhythm and the pitch sequence. A 3-point velocity against 8 onsets drifts
 * through accents — that drift is the musical point of the layer.
 *
 * Universal — accepts any Track. The decision of WHICH tracks expose this
 * editor lives in TrackCard.
 */

interface VelocityLaneProps {
  track: Track;
  onChange: (patch: Partial<Track>) => void;
}

export default function VelocityLane({ track, onChange }: VelocityLaneProps) {
  const [state, dispatch] = useReducer(velocityLaneReducer, undefined, () =>
    initVelocityLaneState(!!track.velocityPattern),
  );

  // Tracks the bar last touched during a drag so cross-bar moves fill the trail.
  const lastIdxRef = useRef<number | null>(null);
  // Always read the latest pattern through a ref — pointermove handlers fire
  // far faster than React re-renders, and we want each move to build on the
  // CURRENT pattern, not a stale closure copy.
  const patternRef = useRef<number[]>(track.velocityPattern ?? []);
  patternRef.current = track.velocityPattern ?? [];

  const containerRef = useRef<HTMLDivElement | null>(null);

  const pattern = track.velocityPattern ?? [];

  const toggle = () => {
    dispatch({ type: 'toggle' });
  };

  const addPoint = () => {
    const last = pattern[pattern.length - 1] ?? 100;
    onChange({ velocityPattern: [...pattern, last] });
  };

  const removePoint = () => {
    if (pattern.length <= 1) return;
    onChange({ velocityPattern: pattern.slice(0, -1) });
  };

  const applyAt = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const N = patternRef.current.length;
    if (N === 0) return;
    const { idx, velocity } = pointerToBarValue(
      clientX - rect.left,
      clientY - rect.top,
      rect.width,
      rect.height,
      N,
    );
    const next = paintBar(patternRef.current, lastIdxRef.current, idx, velocity);
    lastIdxRef.current = idx;
    patternRef.current = next;
    onChange({ velocityPattern: next });
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    lastIdxRef.current = null;
    applyAt(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    applyAt(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    lastIdxRef.current = null;
  };

  return (
    <div className={'velocity-lane' + (state.open ? ' is-on' : '')}>
      <div className="velocity-head">
        <button
          type="button"
          className={'toggle' + (state.open ? ' is-on' : '')}
          data-kind="velocity"
          onClick={toggle}
          aria-pressed={state.open}
          aria-label={`Toggle velocity layer for ${track.name}`}
        >
          ♪ Velocity
        </button>
        {state.open && (
          <>
            <span className="velocity-count">
              {pattern.length} {pattern.length === 1 ? 'point' : 'points'}
            </span>
            <div className="velocity-buttons">
              <button
                type="button"
                className="velocity-step"
                onClick={removePoint}
                disabled={pattern.length <= 1}
                aria-label="Remove last velocity point"
                title="Remove last point"
              >
                −
              </button>
              <button
                type="button"
                className="velocity-step"
                onClick={addPoint}
                aria-label="Add a velocity point"
                title="Add a point at the end"
              >
                +
              </button>
            </div>
          </>
        )}
      </div>

      {state.open && pattern.length > 0 && (
        <div
          ref={containerRef}
          className="velocity-bars"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="slider"
          aria-label={`Velocity sequence for ${track.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pattern[0]}
        >
          {pattern.map((v, i) => (
            <div
              key={i}
              className="velocity-bar"
              style={{ height: `${v}%` }}
              title={`Point ${i + 1}: ${v}%`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
