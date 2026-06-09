import { describe, it, expect } from 'vitest';
import {
  laneReducer,
  initLaneState,
  pitchesFromText,
  PITCH_STARTER,
} from './pitchLaneState';

describe('laneReducer — open/close is controlled only by toggle', () => {
  it('toggle opens a closed lane and seeds the starter text', () => {
    const s = laneReducer(initLaneState('', false), { type: 'toggle' });
    expect(s.open).toBe(true);
    expect(s.text).toBe(PITCH_STARTER);
  });

  it('toggle closes an open lane and clears the text', () => {
    const s = laneReducer({ open: true, text: 'C3 D3' }, { type: 'toggle' });
    expect(s.open).toBe(false);
    expect(s.text).toBe('');
  });

  it('REGRESSION: clearing the text keeps the lane OPEN', () => {
    // Open, type something, then clear it (Ctrl+A -> Delete).
    const opened = laneReducer(initLaneState('', false), { type: 'toggle' });
    const typed = laneReducer(opened, { type: 'setText', text: 'C3 D3 G3' });
    const cleared = laneReducer(typed, { type: 'setText', text: '' });
    expect(cleared.open).toBe(true); // <-- the fix: empty text must NOT close
    expect(cleared.text).toBe('');
  });

  it('REGRESSION: retyping after clearing keeps the lane open throughout', () => {
    let s = laneReducer(initLaneState('', false), { type: 'toggle' });
    s = laneReducer(s, { type: 'setText', text: '' }); // clear
    s = laneReducer(s, { type: 'setText', text: 'E2 G2' }); // retype
    expect(s.open).toBe(true);
    expect(s.text).toBe('E2 G2');
  });

  it('text edits never change the open flag (open stays open, closed stays closed)', () => {
    expect(laneReducer({ open: true, text: 'x' }, { type: 'setText', text: 'y' }).open).toBe(true);
    expect(laneReducer({ open: false, text: '' }, { type: 'setText', text: 'C3' }).open).toBe(false);
  });
});

describe('pitchesFromText — data derivation (independent of open state)', () => {
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
