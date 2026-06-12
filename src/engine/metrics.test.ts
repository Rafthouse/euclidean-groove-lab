import { describe, it, expect } from 'vitest';
import { euclid } from './euclidean';
import { pulse } from './pulse';
import { onsetCount, density } from './metrics';

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
