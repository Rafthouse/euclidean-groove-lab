import { describe, it, expect } from 'vitest';
import { rotate } from './rotate';
import { euclid } from './euclidean';

describe('rotate', () => {
  it('rotates left by a positive amount', () => {
    expect(rotate([1, 2, 3, 4], 1)).toEqual([2, 3, 4, 1]);
  });

  it('rotates right by a negative amount', () => {
    expect(rotate([1, 2, 3, 4], -1)).toEqual([4, 1, 2, 3]);
  });

  it('is identity for 0 and for full-length multiples', () => {
    expect(rotate([1, 2, 3, 4], 0)).toEqual([1, 2, 3, 4]);
    expect(rotate([1, 2, 3, 4], 4)).toEqual([1, 2, 3, 4]);
    expect(rotate([1, 2, 3, 4], 8)).toEqual([1, 2, 3, 4]);
  });

  it('wraps amounts larger than the length', () => {
    expect(rotate([1, 2, 3, 4], 5)).toEqual([2, 3, 4, 1]);
    expect(rotate([1, 2, 3, 4], -5)).toEqual([4, 1, 2, 3]);
  });

  it('handles the empty array', () => {
    expect(rotate([], 3)).toEqual([]);
  });

  it('does not mutate its input', () => {
    const src = [1, 2, 3, 4];
    rotate(src, 2);
    expect(src).toEqual([1, 2, 3, 4]);
  });

  it('rejects non-integer amounts', () => {
    expect(() => rotate([1, 2, 3], 1.5)).toThrow();
  });
});

describe('rotate composed with euclid (rotating a real pattern)', () => {
  const tresillo = euclid(3, 8); // x..x..x.

  it('rotation = 0 is identity', () => {
    expect(rotate(tresillo, 0)).toEqual(tresillo);
  });
  it('rotation = steps wraps to identity', () => {
    expect(rotate(tresillo, 8)).toEqual(tresillo);
  });
  it('rotation > steps wraps around', () => {
    expect(rotate(tresillo, 8 + 3)).toEqual(rotate(tresillo, 3));
  });
  it('negative rotation equals its positive complement', () => {
    expect(rotate(tresillo, -1)).toEqual(rotate(tresillo, 7));
  });
  it('preserves the onset count for any rotation', () => {
    for (let r = -16; r <= 16; r++) {
      expect(rotate(tresillo, r).filter(Boolean).length).toBe(3);
    }
  });
});
