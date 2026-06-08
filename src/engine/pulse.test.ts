import { describe, it, expect } from 'vitest';
import { pulse } from './pulse';
import { onsetCount } from './metrics';

describe('pulse', () => {
  it('creates a silent grid of the requested length', () => {
    expect(pulse(4)).toEqual([false, false, false, false]);
    expect(onsetCount(pulse(16))).toBe(0);
  });

  it('rejects non-positive or non-integer lengths', () => {
    expect(() => pulse(0)).toThrow();
    expect(() => pulse(-4)).toThrow();
    expect(() => pulse(3.2)).toThrow();
  });
});
