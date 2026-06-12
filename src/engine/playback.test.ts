import { describe, it, expect } from 'vitest';
import {
  divider,
  isActive,
  adjustedTick,
  localStep,
  computePhaseOffsetForChange,
} from './playback';

describe('divider — how many 32n master ticks per step', () => {
  it('maps speeds correctly', () => {
    expect(divider(0.5)).toBe(4);
    expect(divider(1)).toBe(2);
    expect(divider(2)).toBe(1);
  });
});

describe('isActive — which global ticks belong to which track', () => {
  it('2× is active on every tick', () => {
    for (let g = 0; g < 8; g++) expect(isActive(g, 2)).toBe(true);
  });
  it('1× is active on even ticks only', () => {
    for (let g = 0; g < 8; g++) expect(isActive(g, 1)).toBe(g % 2 === 0);
  });
  it('0.5× is active every 4 ticks', () => {
    for (let g = 0; g < 16; g++) expect(isActive(g, 0.5)).toBe(g % 4 === 0);
  });
});

describe('adjustedTick — monotonic integer time within the track', () => {
  it('grows by 1 per active tick at each speed', () => {
    expect(adjustedTick(0, 2, 0)).toBe(0);
    expect(adjustedTick(1, 2, 0)).toBe(1);
    expect(adjustedTick(0, 1, 0)).toBe(0);
    expect(adjustedTick(2, 1, 0)).toBe(1);
    expect(adjustedTick(0, 0.5, 0)).toBe(0);
    expect(adjustedTick(4, 0.5, 0)).toBe(1);
  });
  it('respects phaseOffset additively', () => {
    expect(adjustedTick(10, 1, 5)).toBe(10);
    expect(adjustedTick(10, 1, -3)).toBe(2);
  });
});

describe('localStep — forward', () => {
  it('walks 0..N-1 and wraps', () => {
    for (let t = 0; t < 8; t++) {
      expect(localStep(t * 2, 'forward', 1, 0, 4)).toBe(t % 4);
    }
  });
  it('handles N=1 by always returning 0', () => {
    expect(localStep(7, 'forward', 1, 0, 1)).toBe(0);
  });
  it('returns -1 sentinel for N=0', () => {
    expect(localStep(0, 'forward', 1, 0, 0)).toBe(-1);
  });
});

describe('localStep — reverse', () => {
  it('walks N-1..0 and wraps', () => {
    expect(localStep(0, 'reverse', 1, 0, 4)).toBe(3);
    expect(localStep(2, 'reverse', 1, 0, 4)).toBe(2);
    expect(localStep(4, 'reverse', 1, 0, 4)).toBe(1);
    expect(localStep(6, 'reverse', 1, 0, 4)).toBe(0);
    expect(localStep(8, 'reverse', 1, 0, 4)).toBe(3);
  });
});

describe('localStep — pendulum (endpoints play ONCE, Reich convention)', () => {
  it('N=4 → 0,1,2,3,2,1,0,1', () => {
    const seq = [0, 1, 2, 3, 4, 5, 6, 7].map((g) => localStep(g, 'pendulum', 2, 0, 4));
    expect(seq).toEqual([0, 1, 2, 3, 2, 1, 0, 1]);
  });
  it('N=2 → period 2: 0,1,0,1', () => {
    const seq = [0, 1, 2, 3].map((g) => localStep(g, 'pendulum', 2, 0, 2));
    expect(seq).toEqual([0, 1, 0, 1]);
  });
  it('N=1 degenerates to 0', () => {
    expect(localStep(0, 'pendulum', 2, 0, 1)).toBe(0);
    expect(localStep(7, 'pendulum', 2, 0, 1)).toBe(0);
  });
});

describe('computePhaseOffsetForChange — phase preservation', () => {
  const expectPreserved = (
    g: number,
    oldM: 'forward' | 'reverse' | 'pendulum',
    oldS: 0.5 | 1 | 2,
    oldOff: number,
    oldN: number,
    newM: 'forward' | 'reverse' | 'pendulum',
    newS: 0.5 | 1 | 2,
    newN: number,
  ) => {
    const sBefore = localStep(g, oldM, oldS, oldOff, oldN);
    const newOff = computePhaseOffsetForChange(g, oldM, oldS, oldOff, oldN, newM, newS, newN);
    const sAfter = localStep(g, newM, newS, newOff, newN);
    expect(sAfter).toBe(sBefore % newN);
  };

  it('speed change preserves localStep (forward 1× → 2×)', () => {
    expectPreserved(10, 'forward', 1, 0, 16, 'forward', 2, 16);
  });
  it('speed change preserves localStep (forward 1× → 0.5×)', () => {
    expectPreserved(10, 'forward', 1, 0, 16, 'forward', 0.5, 16);
  });
  it('mode change preserves localStep (forward → reverse)', () => {
    expectPreserved(10, 'forward', 1, 0, 16, 'reverse', 1, 16);
  });
  it('mode change preserves localStep (forward → pendulum)', () => {
    expectPreserved(10, 'forward', 1, 0, 16, 'pendulum', 1, 16);
  });
  it('mode change preserves localStep (reverse → pendulum)', () => {
    expectPreserved(10, 'reverse', 1, 0, 16, 'pendulum', 1, 16);
  });
  it('combined mode + speed change preserves localStep', () => {
    expectPreserved(15, 'forward', 1, 0, 16, 'reverse', 2, 16);
  });
  it('successive changes accumulate cleanly (no drift)', () => {
    let g = 10;
    let mode: 'forward' | 'reverse' | 'pendulum' = 'forward';
    let speed: 0.5 | 1 | 2 = 1;
    let offset = 0;
    const N = 16;
    const sequence: Array<['forward' | 'reverse' | 'pendulum', 0.5 | 1 | 2]> = [
      ['reverse', 1],
      ['pendulum', 2],
      ['forward', 0.5],
    ];
    for (const [newMode, newSpeed] of sequence) {
      const sBefore = localStep(g, mode, speed, offset, N);
      offset = computePhaseOffsetForChange(g, mode, speed, offset, N, newMode, newSpeed, N);
      mode = newMode;
      speed = newSpeed;
      const sAfter = localStep(g, mode, speed, offset, N);
      expect(sAfter).toBe(sBefore);
      g += 5;
    }
  });
  it('steps change preserves localStep when new N >= old step', () => {
    expectPreserved(10, 'forward', 1, 0, 16, 'forward', 1, 20);
  });
  it('returns 0 (no preservation) when old config is degenerate (N=0)', () => {
    expect(computePhaseOffsetForChange(10, 'forward', 1, 0, 0, 'forward', 1, 16)).toBe(0);
  });
});

describe('no drift: two tracks always read the same g', () => {
  it('two tracks at different speeds maintain LCM-determined relationship across thousands of ticks', () => {
    const N = 16;
    const seenA = new Set<number>();
    const seenB = new Set<number>();
    for (let g = 0; g < 10000; g++) {
      if (isActive(g, 1)) seenA.add(localStep(g, 'forward', 1, 0, N));
      if (isActive(g, 2)) seenB.add(localStep(g, 'forward', 2, 0, N));
    }
    expect(seenA.size).toBe(N);
    expect(seenB.size).toBe(N);
  });
});
