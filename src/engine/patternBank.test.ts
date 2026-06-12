import { describe, it, expect } from 'vitest';
import {
  snapshotPattern,
  switchTrackPattern,
  PATTERN_SLOT_COUNT,
} from './track';
import type { Track } from './track';

function baseTrack(over: Partial<Track> = {}): Track {
  return {
    id: 'kick',
    name: 'Kick',
    color: '#c084fc',
    steps: 16,
    hits: 4,
    rotation: 0,
    mute: false,
    solo: false,
    voiceId: 'kick',
    volume: 100,
    playbackMode: 'forward',
    playbackSpeed: 1,
    ...over,
  };
}

describe('snapshotPattern', () => {
  it('captures the four generator fields', () => {
    const t = baseTrack({ steps: 12, hits: 5, rotation: 3 });
    expect(snapshotPattern(t)).toEqual({
      steps: 12,
      hits: 5,
      rotation: 3,
      manualMute: undefined,
    });
  });

  it('collapses an all-false mask to undefined', () => {
    const t = baseTrack({ manualMute: [false, false, false] });
    expect(snapshotPattern(t).manualMute).toBeUndefined();
  });

  it('clones a populated mask (no aliasing)', () => {
    const mask = [false, true, false, false];
    const t = baseTrack({ steps: 4, manualMute: mask });
    const snap = snapshotPattern(t);
    expect(snap.manualMute).toEqual(mask);
    expect(snap.manualMute).not.toBe(mask); // defensive copy
  });
});

describe('switchTrackPattern', () => {
  it('materialises an empty target slot as a duplicate of the current pattern', () => {
    const t = baseTrack({ steps: 16, hits: 4, rotation: 2 });
    const next = switchTrackPattern(t, 1, -1);
    expect(next.activePattern).toBe(1);
    // Live fields unchanged (duplicate of A), and BOTH slots now hold the snapshot.
    expect(next.steps).toBe(16);
    expect(next.hits).toBe(4);
    expect(next.rotation).toBe(2);
    expect(next.patterns?.[0]).toMatchObject({ steps: 16, hits: 4, rotation: 2 });
    expect(next.patterns?.[1]).toMatchObject({ steps: 16, hits: 4, rotation: 2 });
  });

  it('preserves each slot independently across edit + switch-back', () => {
    // A: hits 4 → switch to B (copies A) → edit B to hits 7 → switch back to A.
    let t = baseTrack({ hits: 4 });
    t = switchTrackPattern(t, 1, -1);      // now on B, copy of A
    t = { ...t, hits: 7 };                  // edit B live (as updateTrack would)
    t = switchTrackPattern(t, 0, -1);      // back to A

    expect(t.activePattern).toBe(0);
    expect(t.hits).toBe(4);                 // A restored
    expect(t.patterns?.[1]?.hits).toBe(7);  // B's edit preserved

    // Returning to B reloads its edited value.
    t = switchTrackPattern(t, 1, -1);
    expect(t.hits).toBe(7);
  });

  it('clamps a loaded slot (hits ≤ steps, rotation wrapped)', () => {
    // Seed slot 1 with an out-of-range snapshot, then load it.
    const t = baseTrack({
      activePattern: 0,
      patterns: [
        undefined as never, // slot 0 placeholder; overwritten by snapshot on switch
        { steps: 8, hits: 12, rotation: 19 },
      ],
    });
    const next = switchTrackPattern(t, 1, -1);
    expect(next.steps).toBe(8);
    expect(next.hits).toBe(8);       // clamped to steps
    expect(next.rotation).toBe(3);   // 19 mod 8
  });

  it('persists the live snapshot when switching to the already-active slot', () => {
    const t = baseTrack({ activePattern: 2, hits: 6 });
    const next = switchTrackPattern(t, 2, -1);
    expect(next.activePattern).toBe(2);
    expect(next.hits).toBe(6);
    expect(next.patterns?.[2]).toMatchObject({ hits: 6 });
  });

  it('is a no-op for out-of-range slot indices', () => {
    const t = baseTrack();
    expect(switchTrackPattern(t, -1, -1)).toBe(t);
    expect(switchTrackPattern(t, PATTERN_SLOT_COUNT, -1)).toBe(t);
    expect(switchTrackPattern(t, 1.5, -1)).toBe(t);
  });

  it('leaves phaseOffset untouched when stopped (globalStep = -1)', () => {
    const t = baseTrack({
      phaseOffset: 5,
      patterns: [undefined as never, { steps: 8, hits: 3, rotation: 0 }],
    });
    const next = switchTrackPattern(t, 1, -1);
    expect(next.steps).toBe(8);          // steps DID change
    expect(next.phaseOffset).toBe(5);    // but phase preserved-as-is when stopped
  });

  it('does not mutate the input track or its pattern array', () => {
    const patterns = [{ steps: 16, hits: 4, rotation: 0 }];
    const t = baseTrack({ activePattern: 0, patterns });
    const snapshotBefore = JSON.stringify(t);
    switchTrackPattern(t, 1, -1);
    expect(JSON.stringify(t)).toBe(snapshotBefore);
    expect(t.patterns).toBe(patterns); // original array reference intact
  });
});
