/**
 * Tests for Pattern Bank Persistence System
 *
 * Note: localStorage is not available in vitest (Node). We test the data
 * transformation functions (export, import, apply) and structure validation.
 * The localStorage layer (save/load/reset) is tested via API shape + logic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Track, PatternSlot } from './track';
import {
  exportPatternBank,
  importPatternBank,
  applyImportedBank,
  savePatternBank,
  loadPatternBank,
  resetPatternBank,
  hasSavedBank,
} from './patternBank';

// ─── Mock localStorage ───────────────────────────────────────────────────────

const store: Record<string, string> = {};

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTrack(id: string, overrides?: Partial<Track>): Track {
  const base: Track = {
    id,
    name: id,
    color: '#fff',
    steps: 16,
    hits: 4,
    rotation: 0,
    mute: false,
    solo: false,
    voiceId: 'kick',
    volume: 100,
    playbackMode: 'forward',
    playbackSpeed: 1,
  };
  return { ...base, ...overrides };
}

function makeSlot(overrides?: Partial<PatternSlot>): PatternSlot {
  return {
    steps: 16,
    hits: 4,
    rotation: 0,
    ...overrides,
  };
}

function makeSlots(firstSlot?: PatternSlot): (PatternSlot | null)[] {
  const arr: (PatternSlot | null)[] = new Array(22).fill(null);
  if (firstSlot) arr[0] = firstSlot;
  return arr;
}

function makeFullTracks(): Track[] {
  return [
    makeTrack('kick', { voiceId: 'kick', name: 'Kick' }),
    makeTrack('snare', { voiceId: 'snare', name: 'Snare',
      patterns: makeSlots(makeSlot({ steps: 8, hits: 3, rotation: 1 })),
      activePattern: 0,
    }),
    makeTrack('hat', { voiceId: 'hat', name: 'Hat' }),
    makeTrack('bass', { voiceId: 'bass', name: 'Bass' }),
  ];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('patternBank', () => {

  describe('exportPatternBank', () => {
    it('produces valid JSON with version and exportedAt', () => {
      const json = exportPatternBank(makeFullTracks());
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(1);
      expect(parsed.exportedAt).toBeDefined();
      expect(typeof parsed.exportedAt).toBe('string');
      expect(parsed.tracks).toHaveLength(4);
    });

    it('includes all track ids', () => {
      const json = exportPatternBank(makeFullTracks());
      const parsed = JSON.parse(json);
      const ids = parsed.tracks.map((t: any) => t.id);
      expect(ids).toEqual(['kick', 'snare', 'hat', 'bass']);
    });

    it('exports 22 slots per track', () => {
      const json = exportPatternBank(makeFullTracks());
      const parsed = JSON.parse(json);
      for (const t of parsed.tracks) {
        expect(t.patterns).toHaveLength(22);
      }
    });

    it('preserves activePattern in export', () => {
      const tracks = makeFullTracks();
      tracks[1].activePattern = 3;
      const json = exportPatternBank(tracks);
      const parsed = JSON.parse(json);
      expect(parsed.tracks[1].activePattern).toBe(3);
    });

    it('handles tracks with no patterns set', () => {
      const tracks = makeFullTracks();
      tracks[0].patterns = undefined;
      const json = exportPatternBank(tracks);
      const parsed = JSON.parse(json);
      // Should still produce 22 null slots
      expect(parsed.tracks[0].patterns).toHaveLength(22);
      expect(parsed.tracks[0].patterns.every((p: any) => p === null)).toBe(true);
    });

    it('is human-readable (pretty-printed)', () => {
      const json = exportPatternBank(makeFullTracks());
      // Pretty-printed JSON has newlines
      expect(json).toContain('\n');
    });
  });

  describe('importPatternBank', () => {
    it('parses valid export data', () => {
      const json = exportPatternBank(makeFullTracks());
      const result = importPatternBank(json);
      expect(result.version).toBe(1);
      expect(result.tracks).toHaveLength(4);
    });

    it('throws on invalid JSON', () => {
      expect(() => importPatternBank('not json')).toThrow('Invalid JSON');
    });

    it('throws on wrong version', () => {
      const json = exportPatternBank(makeFullTracks());
      const parsed = JSON.parse(json);
      parsed.version = 999;
      expect(() => importPatternBank(JSON.stringify(parsed)))
        .toThrow('Unsupported version');
    });

    it('throws on wrong track count', () => {
      const json = exportPatternBank(makeFullTracks());
      const parsed = JSON.parse(json);
      parsed.tracks = parsed.tracks.slice(0, 2);
      expect(() => importPatternBank(JSON.stringify(parsed)))
        .toThrow('Expected 4 tracks');
    });

    it('throws on missing track id', () => {
      const json = exportPatternBank(makeFullTracks());
      const parsed = JSON.parse(json);
      delete parsed.tracks[0].id;
      expect(() => importPatternBank(JSON.stringify(parsed)))
        .toThrow('missing or invalid id');
    });

    it('throws on wrong slot count', () => {
      const json = exportPatternBank(makeFullTracks());
      const parsed = JSON.parse(json);
      parsed.tracks[0].patterns = parsed.tracks[0].patterns.slice(0, 10);
      expect(() => importPatternBank(JSON.stringify(parsed)))
        .toThrow('expected 22 slots');
    });
  });

  describe('applyImportedBank', () => {
    it('restores patterns onto fresh tracks', () => {
      const tracks = makeFullTracks();
      const json = exportPatternBank(tracks);
      const state = importPatternBank(json);

      // Scramble the tracks
      const fresh = makeFullTracks();
      fresh[0].patterns = undefined;
      fresh[1].patterns = undefined;
      fresh[2].patterns = undefined;
      fresh[3].patterns = undefined;

      const restored = applyImportedBank(fresh, state);
      // track 1 (snare) had patterns, should be restored
      expect(restored[1].patterns).toBeDefined();
      expect(restored[1].patterns![0]?.steps).toBe(8);
    });

    it('does NOT overwrite generator fields', () => {
      const tracks = makeFullTracks();
      const json = exportPatternBank(tracks);
      const state = importPatternBank(json);

      const fresh: Track[] = [
        makeTrack('kick', { voiceId: 'kick', steps: 32, hits: 7 }),
        makeTrack('snare', { voiceId: 'snare', steps: 16, hits: 5 }),
        makeTrack('hat', { voiceId: 'hat', steps: 8, hits: 2 }),
        makeTrack('bass', { voiceId: 'bass', steps: 12, hits: 4 }),
      ];

      const restored = applyImportedBank(fresh, state);
      // Generator fields must remain untouched
      expect(restored[0].steps).toBe(32);
      expect(restored[0].hits).toBe(7);
      expect(restored[1].steps).toBe(16);
      expect(restored[1].hits).toBe(5);
    });
  });

  describe('localStorage roundtrip', () => {
    it('savePatternBank writes to localStorage', () => {
      const tracks = makeFullTracks();
      savePatternBank(tracks);
      expect(hasSavedBank()).toBe(true);
    });

    it('loadPatternBank returns null when nothing saved', () => {
      expect(loadPatternBank()).toBeNull();
    });

    it('save + load roundtrip preserves track ids', () => {
      const tracks = makeFullTracks();
      savePatternBank(tracks);
      const loaded = loadPatternBank();
      expect(loaded).not.toBeNull();
      expect(loaded!.tracks.map((t) => t.id)).toEqual(['kick', 'snare', 'hat', 'bass']);
    });

    it('save + load roundtrip preserves slots', () => {
      const tracks = makeFullTracks();
      savePatternBank(tracks);
      const loaded = loadPatternBank();
      expect(loaded).not.toBeNull();
      for (const t of loaded!.tracks) {
        expect(t.patterns).toHaveLength(22);
      }
    });

    it('resetPatternBank clears saved data', () => {
      const tracks = makeFullTracks();
      savePatternBank(tracks);
      expect(hasSavedBank()).toBe(true);
      resetPatternBank();
      expect(hasSavedBank()).toBe(false);
      expect(loadPatternBank()).toBeNull();
    });

    it('load rejects wrong-version data', () => {
      const tracks = makeFullTracks();
      savePatternBank(tracks);
      const raw = JSON.parse(localStorage.getItem('euclid…pattern-bank')!);
      raw.version = 42;
      localStorage.setItem('euclid…pattern-bank', JSON.stringify(raw));
      expect(loadPatternBank()).toBeNull();
    });

    it('activePattern defaults to 0', () => {
      const tracks = makeFullTracks();
      savePatternBank(tracks);
      const loaded = loadPatternBank();
      expect(loaded!.tracks[0].activePattern).toBe(0);
    });

    it('handles track with some filled slots', () => {
      const tracks = makeFullTracks();
      tracks[2].patterns = new Array(22).fill(null);
      tracks[2].patterns![5] = makeSlot({ steps: 7, hits: 3 });
      tracks[2].patterns![12] = makeSlot({ steps: 11, hits: 5, rotation: 2 });
      savePatternBank(tracks);
      const loaded = loadPatternBank();
      expect(loaded!.tracks[2].patterns[5]).not.toBeNull();
      expect(loaded!.tracks[2].patterns[5]!.steps).toBe(7);
      expect(loaded!.tracks[2].patterns[12]).not.toBeNull();
      expect(loaded!.tracks[2].patterns[12]!.hits).toBe(5);
      // Unfilled slots stay null
      expect(loaded!.tracks[2].patterns[0]).toBeNull();
    });
  });

});
