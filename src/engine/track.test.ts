import { describe, it, expect } from 'vitest';
import { trackPattern, audibleTracks, defaultTracks, computeVelocities, isStepMuted } from './track';
import type { Track, VoiceId } from './track';
import { euclid } from './euclidean';
import { rotate } from './rotate';
import { density, onsetCount } from './metrics';

const make = (overrides: Partial<Track> = {}): Track => ({
  id: 't',
  name: 'T',
  color: '#fff',
  steps: 16,
  hits: 4,
  rotation: 0,
  mute: false,
  solo: false,
  voiceId: 'kick',
  ...overrides,
});

describe('trackPattern', () => {
  it('derives pulses as rotate(euclid(hits, steps), rotation)', () => {
    const t = make({ steps: 8, hits: 3, rotation: 0 });
    expect(trackPattern(t).pulses).toEqual(euclid(3, 8));
  });

  it('applies rotation on top of the Euclidean distribution', () => {
    const t = make({ steps: 8, hits: 3, rotation: 2 });
    expect(trackPattern(t).pulses).toEqual(rotate(euclid(3, 8), 2));
  });

  it('does not pre-populate accents / velocities / microtiming without velocity', () => {
    const tp = trackPattern(make());
    expect(tp.accents).toBeUndefined();
    expect(tp.velocities).toBeUndefined();
    expect(tp.microtiming).toBeUndefined();
  });

  it('populates velocities when velocityEnabled is true and velocity is set', () => {
    const t = make({ hits: 4, steps: 8, velocityEnabled: true, velocity: [100, 80] });
    const tp = trackPattern(t);
    expect(tp.velocities).toBeDefined();
    // E(4,8) = [1,0,1,0,1,0,1,0]; velocity by onset index: 100,80,100,80
    expect(tp.velocities).toEqual([100, 0, 80, 0, 100, 0, 80, 0]);
  });

  it('preserves the contract: groove is never stored, only derived', () => {
    // Two tracks with the same config produce equal-but-not-shared pulses.
    const a = make({ id: 'a' });
    const b = make({ id: 'b' });
    expect(trackPattern(a).pulses).toEqual(trackPattern(b).pulses);
    expect(trackPattern(a).pulses).not.toBe(trackPattern(b).pulses);
  });
});

describe('computeVelocities', () => {
  it('returns zeros for every step when pattern is empty', () => {
    expect(computeVelocities([true, false, true], [])).toEqual([0, 0, 0]);
  });

  it('assigns velocities by onset index 1:1 when pattern matches onset count', () => {
    expect(computeVelocities([true, true, true], [80, 90, 100]))
      .toEqual([80, 90, 100]);
  });

  it('cycles pattern when there are more onsets than pattern length', () => {
    // 4 onsets, pattern length 2 → [100,80,100,80]
    expect(computeVelocities([true, false, true, false, true, false, true, false], [100, 80]))
      .toEqual([100, 0, 80, 0, 100, 0, 80, 0]);
  });

  it('gives velocity 0 to rest positions', () => {
    const result = computeVelocities([true, false, true], [90]);
    expect(result).toEqual([90, 0, 90]);
  });

  it('handles single-step pattern correctly (flat velocity)', () => {
    const result = computeVelocities([true, true, true], [100]);
    expect(result).toEqual([100, 100, 100]);
  });

});



describe('audibleTracks (solo-takes-priority)', () => {
  it('with no solo, returns every non-muted track', () => {
    const tracks: Track[] = [
      make({ id: 'a' }),
      make({ id: 'b', mute: true }),
      make({ id: 'c' }),
    ];
    expect(audibleTracks(tracks).map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('with any solo, returns only soloed tracks', () => {
    const tracks: Track[] = [
      make({ id: 'a' }),
      make({ id: 'b', solo: true }),
      make({ id: 'c' }),
    ];
    expect(audibleTracks(tracks).map((t) => t.id)).toEqual(['b']);
  });

  it('ignores mute within the solo set (mute is dominated by solo)', () => {
    const tracks: Track[] = [
      make({ id: 'a' }),
      make({ id: 'b', solo: true, mute: true }),
    ];
    expect(audibleTracks(tracks).map((t) => t.id)).toEqual(['b']);
  });

  it('returns empty when every track is muted and none is soloed', () => {
    const tracks: Track[] = [
      make({ id: 'a', mute: true }),
      make({ id: 'b', mute: true }),
    ];
    expect(audibleTracks(tracks)).toEqual([]);
  });

  it('returns empty for an empty input', () => {
    expect(audibleTracks([])).toEqual([]);
  });

  it('does not mutate its input', () => {
    const tracks: Track[] = [make({ id: 'a', solo: true }), make({ id: 'b' })];
    const snapshot = JSON.parse(JSON.stringify(tracks));
    audibleTracks(tracks);
    expect(tracks).toEqual(snapshot);
  });
});

describe('defaultTracks', () => {
  const tracks = defaultTracks();

  it('seeds exactly four tracks', () => {
    expect(tracks).toHaveLength(4);
  });

  it('covers all four voice slots exactly once', () => {
    const expected: VoiceId[] = ['kick', 'snare', 'hat', 'bass'];
    expect(tracks.map((t) => t.voiceId).sort()).toEqual([...expected].sort());
  });

  it('has unique ids and distinct colors', () => {
    const ids = new Set(tracks.map((t) => t.id));
    const colors = new Set(tracks.map((t) => t.color));
    expect(ids.size).toBe(4);
    expect(colors.size).toBe(4);
  });

  it('starts unmuted and unsoloed (all four audible)', () => {
    expect(audibleTracks(tracks)).toHaveLength(4);
  });

  it('all default patterns are non-trivial (some onsets, not silent, not solid)', () => {
    for (const t of tracks) {
      const p = trackPattern(t).pulses;
      const onsets = p.filter(Boolean).length;
      expect(onsets).toBeGreaterThan(0);
      expect(onsets).toBeLessThan(p.length);
    }
  });
});

// E(4,8) = [1,0,1,0,1,0,1,0]. Onset indices: 0→step0, 1→step2, 2→step4, 3→step6.
describe('isStepMuted — onset-indexed manual mute overlay', () => {
  it('returns false when there is no mask', () => {
    const t = make({ steps: 8, hits: 4 });
    expect(isStepMuted(t, 0)).toBe(false);
    expect(isStepMuted(t, 5)).toBe(false);
  });

  it('returns false for rest steps even when mask entry would be true', () => {
    // onset-indexed: step 1 is a REST for E(4,8), so it cannot be muted
    const mask = [false, true, false, false]; // onset 1 (step 2) muted
    const t = make({ steps: 8, hits: 4, manualMute: mask });
    expect(isStepMuted(t, 1)).toBe(false); // step 1 = rest
    expect(isStepMuted(t, 3)).toBe(false); // step 3 = rest
  });

  it('mutes the correct onset regardless of step position', () => {
    // Mute onset 1 = step 2 in E(4,8)
    const mask = [false, true, false, false];
    const t = make({ steps: 8, hits: 4, manualMute: mask });
    expect(isStepMuted(t, 2)).toBe(true);  // onset 1 is at step 2
    expect(isStepMuted(t, 0)).toBe(false); // onset 0 is not muted
    expect(isStepMuted(t, 4)).toBe(false); // onset 2 is not muted
  });

  it('wraps the global step modulo pattern length', () => {
    const mask = [false, true, false, false]; // onset 1 → step 2
    const t = make({ steps: 8, hits: 4, manualMute: mask });
    expect(isStepMuted(t, 2 + 8)).toBe(true);  // step 10 → local 2
    expect(isStepMuted(t, 2 + 16)).toBe(true); // step 18 → local 2
  });

  it('muted onset stays at the same event after rotation', () => {
    // E(4,8) rotated 2 = [1,0,1,0,1,0,1,0] → onsets at 0,2,4,6 → same (period 2)
    // Use rotation 1: E(4,8) rotated 1 = [0,1,0,1,0,1,0,1] → onsets at 1,3,5,7
    // Mute onset 0 (now at step 1 after rotation 1).
    const mask = [true, false, false, false]; // onset 0 muted
    const t = make({ steps: 8, hits: 4, rotation: 1, manualMute: mask });
    expect(isStepMuted(t, 1)).toBe(true);  // onset 0 is at step 1 (rotated)
    expect(isStepMuted(t, 0)).toBe(false); // step 0 is now a rest
    expect(isStepMuted(t, 3)).toBe(false); // onset 1, not muted
  });
});

describe('manual mute does NOT touch the generated pattern (Euclidean stays authoritative)', () => {
  it('trackPattern.pulses ignore manualMute entirely', () => {
    // onset 1 muted — but pulses must still show all 4 onsets
    const mask = [false, true, false, false]; // onset-indexed, length 4
    const plain = make({ steps: 8, hits: 4 });
    const muted = make({ steps: 8, hits: 4, manualMute: mask });
    expect(trackPattern(muted).pulses).toEqual(trackPattern(plain).pulses);
  });

  it('density and onset count are unchanged by manualMute (pulses are authoritative)', () => {
    const mask = [true, true, true, true]; // all onsets muted (onset-indexed, length 4)
    const plain = trackPattern(make({ steps: 8, hits: 4 })).pulses;
    const muted = trackPattern(make({ steps: 8, hits: 4, manualMute: mask })).pulses;
    expect(density(muted)).toBe(density(plain));
    expect(onsetCount(muted)).toBe(onsetCount(plain));
  });

  it('effectivePulses suppresses muted onsets; pulses stays unchanged', () => {
    const mask = [false, true, false, false]; // onset 1 = step 2 muted in E(4,8)
    const tp = trackPattern(make({ steps: 8, hits: 4, manualMute: mask }));
    expect(tp.pulses[2]).toBe(true);           // generator still sees it
    expect(tp.effectivePulses[2]).toBe(false); // scheduler skips it
    expect(tp.mutedStepMask[2]).toBe(true);    // UI shows the cross
    expect(tp.mutedStepMask[0]).toBe(false);   // onset 0 untouched
  });
});
