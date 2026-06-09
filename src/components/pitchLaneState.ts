/**
 * Pure state logic for the Pitch Lane, kept out of the React component so the
 * key invariant — editing the text never opens or closes the lane — is unit
 * testable in the node environment (no DOM, no testing-library).
 *
 * The bug this fixes: the lane's open/closed state used to be derived from
 * `!!track.pitches`, so clearing the text (which makes pitches undefined)
 * collapsed the lane mid-edit. Here the UI "open" state is independent from the
 * sequence DATA; only the toggle changes `open`.
 */
import { parseNoteSequence } from '../engine';
import type { PitchSequence } from '../engine';

export const PITCH_STARTER = 'C3 D3 G3 Bb3';

export interface LaneState {
  /** UI: is the lane expanded? Controlled ONLY by the toggle, never by data. */
  open: boolean;
  /** The raw text in the editor (kept verbatim so partial input is preserved). */
  text: string;
}

export type LaneAction =
  | { type: 'toggle' }
  | { type: 'setText'; text: string };

export function initLaneState(pitchesText: string, hasPitches: boolean): LaneState {
  return { open: hasPitches, text: pitchesText };
}

export function laneReducer(state: LaneState, action: LaneAction): LaneState {
  switch (action.type) {
    case 'toggle':
      // Closing clears the text; opening seeds a starter sequence.
      return state.open
        ? { open: false, text: '' }
        : { open: true, text: PITCH_STARTER };
    case 'setText':
      // Text edits NEVER touch `open` — this is the whole fix.
      return { ...state, text: action.text };
    default:
      return state;
  }
}

/**
 * Derive the Track.pitches patch from the editor text. Empty / all-invalid
 * input yields `undefined` (no pitch layer in the DATA) — but that no longer
 * affects whether the lane is open (that is `LaneState.open`).
 */
export function pitchesFromText(trackId: string, text: string): PitchSequence | undefined {
  const { slots } = parseNoteSequence(text);
  return slots.length === 0 ? undefined : { id: `${trackId}-pitch`, slots };
}
