import { describe, it, expect } from 'vitest';
import { phase } from './phase';
import { euclid } from './euclidean';

describe('phase', () => {
  it('returns onset times equal to onset indices at offset 0', () => {
    const p = euclid(3, 8); // onsets 0, 3, 6
    expect(phase(p, 0).map((o) => o.time)).toEqual([0, 3, 6]);
  });

  it('shifts every onset by a fractional offset', () => {
    const p = euclid(3, 8);
    expect(phase(p, 0.5).map((o) => o.time)).toEqual([0.5, 3.5, 6.5]);
  });

  it('wraps onsets past the cycle boundary and re-sorts by time', () => {
    const p = euclid(3, 8); // onsets 0, 3, 6 -> +2 -> 2, 5, 0 -> sorted 0, 2, 5
    expect(phase(p, 2).map((o) => o.time)).toEqual([0, 2, 5]);
  });

  it('agrees with an integer rotation of onset positions', () => {
    const p = euclid(5, 16); // onsets 0, 3, 6, 9, 12
    const times = phase(p, 3)
      .map((o) => o.time)
      .sort((a, b) => a - b);
    expect(times).toEqual([3, 6, 9, 12, 15]);
  });

  it('preserves the originating step index', () => {
    const p = euclid(3, 8);
    const byStep = phase(p, 2).slice().sort((a, b) => a.step - b.step);
    expect(byStep.map((o) => o.step)).toEqual([0, 3, 6]);
  });

  it('rejects non-finite offsets', () => {
    expect(() => phase(euclid(3, 8), Infinity)).toThrow();
  });
});
