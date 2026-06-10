import { describe, it, expect } from 'vitest';
import {
  velocityLaneReducer,
  initVelocityLaneState,
  paintBar,
  pointerToBarValue,
  VELOCITY_STARTER,
} from './velocityLaneState';

describe('velocityLaneReducer — open/close controlled only by toggle', () => {
  it('toggle opens a closed lane', () => {
    expect(velocityLaneReducer({ open: false }, { type: 'toggle' })).toEqual({ open: true });
  });

  it('toggle closes an open lane', () => {
    expect(velocityLaneReducer({ open: true }, { type: 'toggle' })).toEqual({ open: false });
  });

  it('init reflects whether the track already has a velocity pattern', () => {
    expect(initVelocityLaneState(true)).toEqual({ open: true });
    expect(initVelocityLaneState(false)).toEqual({ open: false });
  });

  it('default starter is a single flat point at 100', () => {
    expect(VELOCITY_STARTER).toEqual([100]);
  });
});

describe('paintBar — single-bar update (no drag history)', () => {
  it('updates the target bar when there is no previous index', () => {
    expect(paintBar([50, 50, 50, 50], null, 2, 80)).toEqual([50, 50, 80, 50]);
  });

  it('clamps the value to [0, 100] and rounds', () => {
    expect(paintBar([50], null, 0, 150)).toEqual([100]);
    expect(paintBar([50], null, 0, -10)).toEqual([0]);
    expect(paintBar([50], null, 0, 77.7)).toEqual([78]);
  });

  it('returns an empty pattern unchanged', () => {
    expect(paintBar([], null, 0, 50)).toEqual([]);
  });

  it('does not mutate the input', () => {
    const pattern = [10, 20, 30];
    const snapshot = [...pattern];
    paintBar(pattern, null, 1, 99);
    expect(pattern).toEqual(snapshot);
  });
});

describe('paintBar — cross-bar drag (fills the trail)', () => {
  it('fills every bar between fromIdx and toIdx with the same value', () => {
    expect(paintBar([10, 20, 30, 40, 50], 1, 3, 80)).toEqual([10, 80, 80, 80, 50]);
  });

  it('works regardless of drag direction (low->high or high->low)', () => {
    expect(paintBar([10, 20, 30, 40, 50], 3, 1, 80)).toEqual([10, 80, 80, 80, 50]);
  });

  it('clamps fromIdx/toIdx to the pattern bounds', () => {
    expect(paintBar([10, 20, 30], -5, 10, 50)).toEqual([50, 50, 50]);
  });

  it('updates a single bar when fromIdx === toIdx', () => {
    expect(paintBar([10, 20, 30], 1, 1, 77)).toEqual([10, 77, 30]);
  });
});

describe('pointerToBarValue — pure pointer math', () => {
  it('maps an x position in the centre of bar 2 of 4 to idx 2', () => {
    // container width 200, 4 bars -> 50px each; bar 2 centre = x = 125
    expect(pointerToBarValue(125, 50, 200, 100, 4).idx).toBe(2);
  });

  it('maps top of container (y=0) to velocity 100', () => {
    expect(pointerToBarValue(50, 0, 200, 100, 4).velocity).toBe(100);
  });

  it('maps bottom of container (y=height) to velocity 0', () => {
    expect(pointerToBarValue(50, 100, 200, 100, 4).velocity).toBe(0);
  });

  it('clamps x outside the container into a valid bar index', () => {
    expect(pointerToBarValue(-50, 50, 200, 100, 4).idx).toBe(0);
    expect(pointerToBarValue(500, 50, 200, 100, 4).idx).toBe(3);
  });

  it('clamps y outside the container into [0, 100]', () => {
    expect(pointerToBarValue(50, -10, 200, 100, 4).velocity).toBe(100);
    expect(pointerToBarValue(50, 200, 200, 100, 4).velocity).toBe(0);
  });
});
