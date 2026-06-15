/**
 * Pattern Bank Persistence — localStorage-backed storage for per-track pattern slots.
 *
 * Architecture (V1):
 *   - localStorage key: "euclid…pattern-bank"
 *   - Each track stores 22 PatternSlot snapshots (A–V)
 *   - Auto-save on every pattern change, auto-restore on app mount
 *   - JSON export/import with versioned format
 *
 * Separation from Preset Browser:
 *   - Pattern Bank = per-track Euclidean generator snapshots (22 slots × 4 tracks)
 *   - Preset Browser = full groove snapshots (all 4 tracks + BPM + swing + theme)
 *
 * Future: IndexedDB, cloud storage, auto-sync.
 */

import type { Track, PatternSlot } from './track';

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'euclid…pattern-bank';
const CURRENT_VERSION = 1;
const EXPECTED_TRACKS = 4;
const EXPECTED_SLOTS = 22;

// ─── Types ───────────────────────────────────────────────────────────────────

/** Serializable per-track bank state. */
export interface PatternBankTrackState {
  id: string;
  patterns: PatternSlot[];
  activePattern: number;
}

/** Top-level storage format. */
export interface PatternBankState {
  version: number;
  tracks: PatternBankTrackState[];
}

/** Export format includes metadata. */
export interface PatternBankExport extends PatternBankState {
  exportedAt: string;
}

// ─── Save ────────────────────────────────────────────────────────────────────

/**
 * Serialise all tracks' pattern banks to localStorage.
 * Only the `patterns` and `activePattern` fields are saved — live generator
 * state (steps, hits, rotation, volume, modules) is NEVER touched by this
 * system. That contract is enforced here.
 */
export function savePatternBank(tracks: Track[]): void {
  try {
    const state: PatternBankState = {
      version: CURRENT_VERSION,
      tracks: tracks.map((t) => ({
        id: t.id,
        patterns: t.patterns && t.patterns.length === EXPECTED_SLOTS
          ? t.patterns.map((s) => s ? { ...s } : { steps: t.steps, hits: 0, rotation: 0, phaseOffset: 0 })
          : Array.from({ length: EXPECTED_SLOTS }, () => ({ steps: t.steps, hits: 0, rotation: 0, phaseOffset: 0 })),
        activePattern: t.activePattern ?? 0,
      })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — fail silently (no crash)
  }
}

// ─── Load ────────────────────────────────────────────────────────────────────

/**
 * Load saved bank state from localStorage.
 * Returns `null` when no saved data exists, version mismatch, or parse error.
 */
export function loadPatternBank(): PatternBankState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: PatternBankState = JSON.parse(raw);

    // Version check
    if (parsed.version !== CURRENT_VERSION) return null;

    // Structure validation
    if (!Array.isArray(parsed.tracks) || parsed.tracks.length !== EXPECTED_TRACKS) {
      return null;
    }

    for (const t of parsed.tracks) {
      if (!t.id || typeof t.id !== 'string') return null;
      if (!Array.isArray(t.patterns) || t.patterns.length !== EXPECTED_SLOTS) return null;
      if (typeof t.activePattern !== 'number') t.activePattern = 0;
      // Sanitise: activePattern must be in range
      if (t.activePattern < 0 || t.activePattern >= EXPECTED_SLOTS) {
        t.activePattern = 0;
      }
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Restore saved pattern bank into tracks array.
 * Only overwrites `patterns` and `activePattern` fields on each track.
 * If no saved data exists, tracks are returned unchanged.
 */
export function restorePatternBank(tracks: Track[]): Track[] {
  const saved = loadPatternBank();
  if (!saved) return tracks;

  return tracks.map((track) => {
    const savedTrack = saved.tracks.find((st) => st.id === track.id);
    if (!savedTrack) return track;

    // Only restore patterns & activePattern — NEVER touch live generator state
    const hasPatterns = savedTrack.patterns.some((p) => p.hits > 0 || p.steps !== track.steps);
    return {
      ...track,
      patterns: hasPatterns ? savedTrack.patterns : track.patterns,
      activePattern: savedTrack.activePattern ?? track.activePattern ?? 0,
    };
  });
}

// ─── Export / Import ─────────────────────────────────────────────────────────

/**
 * Generate a downloadable JSON string of the current pattern bank.
 */
export function exportPatternBank(tracks: Track[]): string {
  const state: PatternBankState = {
    version: CURRENT_VERSION,
    tracks: tracks.map((t) => ({
      id: t.id,
      patterns: t.patterns && t.patterns.length === EXPECTED_SLOTS
        ? t.patterns.map((s) => (s ? { ...s } : null))
        : new Array(EXPECTED_SLOTS).fill(null),
      activePattern: t.activePattern ?? 0,
    })),
  };
  const exportData: PatternBankExport = {
    ...state,
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(exportData, null, 2);
}

/**
 * Parse and validate an imported pattern bank JSON string.
 * Returns the parsed state on success, throws on invalid data.
 */
export function importPatternBank(json: string): PatternBankState {
  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON format');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Import data must be a JSON object');
  }

  if (parsed.version !== CURRENT_VERSION) {
    throw new Error(
      `Unsupported version: ${parsed.version}. Expected: ${CURRENT_VERSION}`,
    );
  }

  if (!Array.isArray(parsed.tracks) || parsed.tracks.length !== EXPECTED_TRACKS) {
    throw new Error(
      `Expected ${EXPECTED_TRACKS} tracks, got ${parsed.tracks?.length ?? 0}`,
    );
  }

  for (const [i, t] of parsed.tracks.entries()) {
    if (!t.id || typeof t.id !== 'string') {
      throw new Error(`Track ${i}: missing or invalid id`);
    }
    if (!Array.isArray(t.patterns) || t.patterns.length !== EXPECTED_SLOTS) {
      throw new Error(
        `Track "${t.id}": expected ${EXPECTED_SLOTS} slots, got ${t.patterns?.length ?? 0}`,
      );
    }
    if (typeof t.activePattern !== 'number') {
      t.activePattern = 0;
    }
  }

  return parsed as PatternBankState;
}

/**
 * Apply an imported bank state to tracks array.
 * Same contract as restorePatternBank — only overwrites patterns/activePattern.
 */
export function applyImportedBank(tracks: Track[], state: PatternBankState): Track[] {
  return tracks.map((track) => {
    const savedTrack = state.tracks.find((st) => st.id === track.id);
    if (!savedTrack) return track;
    const hasPatterns = savedTrack.patterns.some((p) => p !== null);
    return {
      ...track,
      patterns: hasPatterns ? savedTrack.patterns : track.patterns,
      activePattern: savedTrack.activePattern ?? track.activePattern ?? 0,
    };
  });
}

// ─── Reset ───────────────────────────────────────────────────────────────────

/** Clear all saved pattern bank data from localStorage. */
export function resetPatternBank(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // unavailable
  }
}

/** Check whether saved pattern bank data exists. */
export function hasSavedBank(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
