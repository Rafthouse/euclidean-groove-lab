import { describe, it, expect } from 'vitest';
import { euclid } from './euclidean';
import { pulse } from './pulse';
import {
  onsetCount,
  density,
  interOnsetIntervals,
  isMaximallyEven,
  balance,
  metricWeights,
  syncopation,
} from './metrics';

const P = (s: string): boolean[] => [...s].map((c) => c === 'x');

describe('onsetCount & density', () => {
  it('counts onsets', () => {
    expect(onsetCount(P('x..x..x.'))).toBe(3);
    expect(onsetCount(pulse(16))).toBe(0);
  });

  it('density is onsets / steps', () => {
    expect(density(P('x..x..x.'))).toBeCloseTo(3 / 8);
    expect(density(P('xxxx'))).toBe(1);
    expect(density([])).toBe(0);
  });
});

describe('interOnsetIntervals', () => {
  it('returns cyclic gaps that sum to the length', () => {
    expect(interOnsetIntervals(P('x..x..x.'))).toEqual([3, 3, 2]);
  });

  it('is [] for no onsets and [n] for a single onset', () => {
    expect(interOnsetIntervals(P('....'))).toEqual([]);
    expect(interOnsetIntervals(P('x...'))).toEqual([4]);
  });
});

describe('isMaximallyEven', () => {
  it('is true for Euclidean rhythms', () => {
    expect(isMaximallyEven(euclid(5, 16))).toBe(true);
    expect(isMaximallyEven(euclid(7, 12))).toBe(true);
  });

  it('is false for a lopsided pattern', () => {
    expect(isMaximallyEven(P('xx....x.'))).toBe(false);
  });
});

describe('balance', () => {
  it('is 1 for evenly spaced onsets', () => {
    expect(balance(P('x.x.x.x.'))).toBeCloseTo(1);
    expect(balance(P('xxxx'))).toBeCloseTo(1);
  });

  it('is 0 for a single onset', () => {
    expect(balance(P('x...'))).toBeCloseTo(0);
  });

  it('is 0 for no onsets', () => {
    expect(balance(P('....'))).toBe(0);
  });
});

describe('metricWeights (LHL)', () => {
  it('gives the downbeat the highest weight', () => {
    expect(metricWeights(8)).toEqual([0, -3, -2, -3, -1, -3, -2, -3]);
  });

  it('rejects non-power-of-two meters', () => {
    expect(() => metricWeights(12)).toThrow();
  });
});

describe('syncopation (LHL-style)', () => {
  it('is 0 for an on-the-beat pattern', () => {
    expect(syncopation(P('x...x...x...x...'))).toBe(0);
  });

  it('is 0 when there are fewer than two onsets', () => {
    expect(syncopation(P('x...'))).toBe(0);
    expect(syncopation(P('....'))).toBe(0);
  });

  it('is positive for the tresillo (note held over beat 2)', () => {
    expect(syncopation(P('x..x..x.'))).toBe(2);
  });

  it('accepts custom weights for non-binary meters', () => {
    const flat = new Array(6).fill(0); // no position outranks another
    expect(syncopation(P('x.x.x.'), flat)).toBe(0);
  });
});
