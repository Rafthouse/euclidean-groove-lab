import { describe, it, expect } from 'vitest';
import {
  laneReducer,
  initLaneState,
  pitchesFromText,
  PITCH_STARTER,
} from './pitchLaneState';

/**
 * Under the new module contract:
 *   - The lane's visibility is derived from `track.pitchEnabled` (not LaneState).
 *   - LaneState owns ONLY the raw editor text, so partial typing is preserved.
 *   - The reducer therefore has a single action: setText. Toggle is done on the
 *     Track via onChange, not in this reducer.
 */
describe('laneReducer — text-only state, never destroys data', () => {
  it('initLaneState seeds the text', () => {
    expect(initLaneState('C3 D3 G3').text).toBe('C3 D3 G3');
    expect(initLaneState('').text).toBe('');
  });

  it('setText updates the text', () => {
    expect(laneReducer({ text: 'old' }, { type: 'setText', text: 'new' }).text).toBe('new');
  });

  it('setText to empty preserves the field (but it can be empty)', () => {
    expect(laneReducer({ text: 'C3 D3' }, { type: 'setText', text: '' }).text).toBe('');
  });

  it('PITCH_STARTER is a non-empty starter sequence', () => {
    expect(PITCH_STARTER.length).toBeGreaterThan(0);
  });
});

describe('pitchesFromText — data derivation', () => {
  it('empty text -> undefined (no pitch layer in the data)', () => {
    expect(pitchesFromText('bass', '')).toBeUndefined();
    expect(pitchesFromText('bass', '   ')).toBeUndefined();
  });

  it('all-invalid text -> undefined', () => {
    expect(pitchesFromText('bass', 'wat nope')).toBeUndefined();
  });

  it('valid notes -> a sequence keyed by the track id', () => {
    const seq = pitchesFromText('bass', 'C3 D3');
    expect(seq).toBeDefined();
    expect(seq!.id).toBe('bass-pitch');
    expect(seq!.slots).toHaveLength(2);
  });
});
