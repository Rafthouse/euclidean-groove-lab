import { describe, it, expect } from 'vitest';
import { trackPattern, audibleTracks, defaultTracks } from './track';
import type { Track, VoiceId } from './track';
import { euclid } from './euclidean';
import { rotate } from './rotate';

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

  it('does not pre-populate accents / velocities / microtiming', () => {
    const tp = trackPattern(make());
    expect(tp.accents).toBeUndefined();
    expect(tp.velocities).toBeUndefined();
    expect(tp.microtiming).toBeUndefined();
  });

  it('preserves the contract: groove is never stored, only derived', () => {
    // Two tracks with the same config produce equal-but-not-shared pulses.
    const a = make({ id: 'a' });
    const b = make({ id: 'b' });
    expect(trackPattern(a).pulses).toEqual(trackPattern(b).pulses);
    expect(trackPattern(a).pulses).not.toBe(trackPattern(b).pulses);
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
