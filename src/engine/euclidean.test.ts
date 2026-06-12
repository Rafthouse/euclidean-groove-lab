import { describe, it, expect } from 'vitest';
import { euclid } from './euclidean';
import { onsetCount } from './metrics';

const show = (p: boolean[]): string => p.map((b) => (b ? 'x' : '.')).join('');

describe('euclid (Bjorklund)', () => {
  it('places no onsets when hits = 0', () => {
    expect(show(euclid(0, 8))).toBe('........');
  });

  it('fills every step when hits = steps', () => {
    expect(show(euclid(8, 8))).toBe('xxxxxxxx');
  });

  it('clamps hits > steps to all onsets', () => {
    expect(show(euclid(12, 8))).toBe('xxxxxxxx');
  });

  it('matches canonical named rhythms', () => {
    expect(show(euclid(1, 4))).toBe('x...');
    expect(show(euclid(2, 5))).toBe('x.x..');
    expect(show(euclid(3, 8))).toBe('x..x..x.'); // tresillo
    expect(show(euclid(5, 8))).toBe('x.xx.xx.'); // cinquillo
    expect(show(euclid(4, 12))).toBe('x..x..x..x..');
    expect(show(euclid(5, 16))).toBe('x..x..x..x..x...');
  });

  it('always starts on an onset when hits > 0', () => {
    for (let steps = 2; steps <= 32; steps++) {
      for (let hits = 1; hits <= steps; hits++) {
        expect(euclid(hits, steps)[0]).toBe(true);
      }
    }
  });

  it('produces exactly `hits` onsets (clamped to steps)', () => {
    for (let steps = 1; steps <= 32; steps++) {
      for (let hits = 0; hits <= steps + 3; hits++) {
        expect(onsetCount(euclid(hits, steps))).toBe(Math.min(hits, steps));
      }
    }
  });

  
  it('rejects invalid input', () => {
    expect(() => euclid(3, 0)).toThrow();
    expect(() => euclid(-1, 8)).toThrow();
    expect(() => euclid(2.5, 8)).toThrow();
    expect(() => euclid(3, 8.5)).toThrow();
  });
});

describe('euclid (named edge cases)', () => {
  it('steps=1, hits=1 -> a single onset', () => {
    expect(show(euclid(1, 1))).toBe('x');
  });
  it('steps=1, hits=0 -> a single rest', () => {
    expect(show(euclid(0, 1))).toBe('.');
  });
  it('steps=16, hits=16 -> every step is an onset', () => {
    expect(show(euclid(16, 16))).toBe('x'.repeat(16));
  });
  it('steps=16, hits=0 -> every step is silent', () => {
    expect(show(euclid(0, 16))).toBe('.'.repeat(16));
  });
  it('hits > steps clamps to all onsets', () => {
    expect(show(euclid(20, 16))).toBe('x'.repeat(16));
  });
});
