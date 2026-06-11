import { describe, it, expect } from 'vitest';
import { trackPattern, audibleTracks, defaultTracks, computeVelocities, isStepMuted, VELOCITY_PRESETS } from './track';
import type { Track, VoiceId, VelocityPattern } from './track';
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

  it('does not pre-populate accents / velocities / microtiming without velocityPattern', () => {
    const tp = trackPattern(make());
    expect(tp.accents).toBeUndefined();
    expect(tp.velocities).toBeUndefined();
    expect(tp.microtiming).toBeUndefined();
  });

  it('populates velocities when velocityEnabled is true and velocityPattern is set', () => {
    const t = make({ hits: 4, steps: 8, velocityEnabled: true, velocityPattern: [100, 80] });
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

  it('works with all built-in presets without throwing', () => {
    const pulses = [true, false, true, false, true, false, true, false, true, false, true, false];
    for (const key of [1, 2, 3, 4, 5]) {
      const pattern = VELOCITY_PRESETS[key];
      const result = computeVelocities(pulses, pattern);
      expect(result).toHaveLength(pulses.length);
      expect(result.filter(v => v > 0).length).toBe(6); // 6 onsets
    }
  });
});

describe('VELOCITY_PRESETS', () => {
  it('has five modes (1 through 5)', () => {
    expect(Object.keys(VELOCITY_PRESETS)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('mode 1 is flat 100', () => {
    expect(VELOCITY_PRESETS[1]).toEqual([100]);
  });

  it('mode 3 is ascending 80→90→100', () => {
    expect(VELOCITY_PRESETS[3]).toEqual([80, 90, 100]);
  });

  it('mode 5 is 5-step linear ramp', () => {
    expect(VELOCITY_PRESETS[5]).toHaveLength(5);
    expect(VELOCITY_PRESETS[5][0]).toBe(80);
    expect(VELOCITY_PRESETS[5][4]).toBe(100);
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

describe('isStepMuted (manual mute overlay)', () => {
  it('returns false when there is no mask', () => {
    const t = make({ steps: 8, hits: 4 });
    expect(isStepMuted(t, 0)).toBe(false);
    expect(isStepMuted(t, 5)).toBe(false);
  });

  it('returns true only for masked step indices', () => {
    const mask = [false, false, true, false, false, false, false, false];
    const t = make({ steps: 8, hits: 4, manualMute: mask });
    expect(isStepMuted(t, 2)).toBe(true);
    expect(isStepMuted(t, 0)).toBe(false);
  });

  it('wraps the global step into the pattern length', () => {
    const mask = [false, false, true, false, false, false, false, false];
    const t = make({ steps: 8, hits: 4, manualMute: mask });
    expect(isStepMuted(t, 2 + 8)).toBe(true); // step 10 -> local 2
    expect(isStepMuted(t, 2 + 16)).toBe(true); // step 18 -> local 2
  });
});

describe('manual mute does NOT touch the generated pattern (Euclidean stays authoritative)', () => {
  it('trackPattern.pulses ignore manualMute entirely', () => {
    const mask = [false, false, true, false, false, false, false, false];
    const plain = make({ steps: 8, hits: 4 });
    const muted = make({ steps: 8, hits: 4, manualMute: mask });
    expect(trackPattern(muted).pulses).toEqual(trackPattern(plain).pulses);
  });

  it('density and onset count are unchanged by manualMute', () => {
    const mask = [true, true, true, true, true, true, true, true];
    const plain = trackPattern(make({ steps: 8, hits: 4 })).pulses;
    const muted = trackPattern(make({ steps: 8, hits: 4, manualMute: mask })).pulses;
    expect(density(muted)).toBe(density(plain));
    expect(onsetCount(muted)).toBe(onsetCount(plain));
  });
});
