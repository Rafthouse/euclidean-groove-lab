/**
 * Pure state logic for the Pitch Lane.
 *
 * Under the module contract, the lane's open/closed state is derived from
 * `track.pitchEnabled` — a Track-level boolean preserved across sessions —
 * NOT from local UI state. The reducer therefore only owns the raw editor
 * text (so partial typing is preserved while the user is editing). Toggling
 * the lane never clears `Track.pitches`; data and visibility are fully
 * orthogonal.
 */
import { parseNoteSequence } from '../engine';
import type { PitchSequence } from '../engine';

export const PITCH_STARTER = 'C3 D3 G3 Bb3';

export interface LaneState {
  /** The raw text in the editor (kept verbatim so partial input survives). */
  text: string;
}

export type LaneAction = { type: 'setText'; text: string };

export function initLaneState(pitchesText: string): LaneState {
  return { text: pitchesText };
}

export function laneReducer(state: LaneState, action: LaneAction): LaneState {
  switch (action.type) {
    case 'setText':
      return { ...state, text: action.text };
    default:
      return state;
  }
}

/**
 * Derive the Track.pitches patch from the editor text. Empty / all-invalid
 * input yields `undefined` (no pitch layer in the DATA) — but that no longer
 * affects whether the lane is open (that is `Track.pitchEnabled`).
 */
export function pitchesFromText(trackId: string, text: string): PitchSequence | undefined {
  const { slots } = parseNoteSequence(text);
  return slots.length === 0 ? undefined : { id: `${trackId}-pitch`, slots };
}
