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
    const snap = snapshotPattern(t);
    expect(snap.steps).toBe(12);
    expect(snap.hits).toBe(5);
    expect(snap.rotation).toBe(3);
    expect(snap.manualMute).toBeUndefined();
  });

  it('captures velocity module state when present', () => {
    const t = baseTrack({ velocity: [100, 80], velocityEnabled: true });
    const snap = snapshotPattern(t);
    expect(snap.velocity).toEqual([100, 80]);
    expect(snap.velocityEnabled).toBe(true);
    expect(snap.velocity).not.toBe(t.velocity); // defensive copy
  });

  it('captures ghost module state when present', () => {
    const ghost = { enabled: true, amount: 40, delaySteps: 2, probability: 0.5, hpHz: 200, lpHz: 6000 };
    const t = baseTrack({ ghost });
    const snap = snapshotPattern(t);
    expect(snap.ghost).toEqual(ghost);
    expect(snap.ghost).not.toBe(ghost); // defensive copy
  });

  it('does not include module fields that are not set on the track', () => {
    const t = baseTrack(); // no velocity / pitches / ghost
    const snap = snapshotPattern(t);
    expect('velocity' in snap).toBe(false);
    expect('pitches' in snap).toBe(false);
    expect('ghost' in snap).toBe(false);
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

  it('restores velocity module state from the target slot', () => {
    // Slot 1 was stored with velocity [100, 80]. Switching to it should load that.
    const t = baseTrack({
      activePattern: 0,
      velocity: [90],
      velocityEnabled: false,
      patterns: [
        undefined as never,
        { steps: 16, hits: 4, rotation: 0, velocity: [100, 80], velocityEnabled: true },
      ],
    });
    const next = switchTrackPattern(t, 1, -1);
    expect(next.velocity).toEqual([100, 80]);
    expect(next.velocityEnabled).toBe(true);
  });

  it('restores ghost module state from the target slot', () => {
    const ghost = { enabled: true, amount: 50, delaySteps: 1, probability: 0.7, hpHz: 200, lpHz: 6000 };
    const t = baseTrack({
      activePattern: 0,
      patterns: [
        undefined as never,
        { steps: 16, hits: 4, rotation: 0, ghost },
      ],
    });
    const next = switchTrackPattern(t, 1, -1);
    expect(next.ghost).toEqual(ghost);
    expect(next.ghost).not.toBe(ghost); // defensive copy
  });

  it('leaves module state unchanged when the target slot has no module fields', () => {
    // Slot 1 has only rhythm fields — module state should be inherited from track.
    const t = baseTrack({
      velocity: [100, 80],
      velocityEnabled: true,
      activePattern: 0,
      patterns: [
        undefined as never,
        { steps: 8, hits: 3, rotation: 0 }, // no velocity / ghost / pitches
      ],
    });
    const next = switchTrackPattern(t, 1, -1);
    expect(next.velocity).toEqual([100, 80]); // preserved from track
    expect(next.velocityEnabled).toBe(true);
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
