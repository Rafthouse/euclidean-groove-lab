/**
 * Preset architecture for Euclidean Groove Spielzeug.
 *
 * Two-tier system:
 *   Factory presets — embedded, read-only for normal users, authorable in
 *                      Developer Mode.
 *   User presets    — stored in IndexedDB, full CRUD for the owning user.
 *
 * In v1 there is no backend. Presets are stored as JSON blobs.
 * When a cloud API arrives, swap the storage adapter without touching the UI.
 *
 * Roles:
 *   USER  → create, edit, delete own user presets
 *   ADMIN → same as USER + manage factory presets (edit, publish, categorise)
 */

import type { Track } from './track';

export type ThemeId =
  | 'dark' | 'paper' | 'elements' | 'military' | 'old-school'
  | 'cherry' | 'nostradamus' | 'big-boss' | 'university'
  | 'neon-void' | 'dark-side' | 'bauhaus' | 'smoke-dub'
  | 'nautilus' | 'satisfaction' | 'revelation' | 'high-contrast'
  | 'candyflip' | 'barbie' | 'alchemy' | 'beekeeper';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A snapshot of the entire groovebox (except preset meta). */
export interface GrooveSnapshot {
  bpm: number;
  swing: number;
  tracks: Track[];
  theme: ThemeId;
}

export type PresetCategory =
  | 'Basic'
  | 'House'
  | 'Techno'
  | 'Breakbeat'
  | 'Experimental'
  | 'Euclidean Studies'
  | 'User'
  | 'Uncategorised';

export const FACTORY_CATEGORIES: PresetCategory[] = [
  'Basic',
  'House',
  'Techno',
  'Breakbeat',
  'Experimental',
  'Euclidean Studies',
];

/** Core preset data — shared by factory and user presets. */
export interface PresetData {
  name: string;
  category: PresetCategory;
  description: string;
  tags: string[];
  groove: GrooveSnapshot;
}

/** A preset as stored and displayed. */
export interface Preset {
  id: string;
  kind: 'factory' | 'user';
  name: string;
  category: PresetCategory;
  description: string;
  tags: string[];
  groove: GrooveSnapshot;
  /** Factory presets carry extra metadata. */
  version?: number;
  createdAt?: number;   // unix ms
  updatedAt?: number;   // unix ms
}

// ---------------------------------------------------------------------------
// Factory presets — embedded as a typed module
// ---------------------------------------------------------------------------

import { defaultTracks } from './track';

const factoryPresets: Preset[] = [
  {
    id: 'factory-4x4',
    kind: 'factory',
    name: 'Basic 4/4',
    category: 'Basic',
    description: 'Simple four-on-the-floor foundation. Kick on every beat, snare on 2 & 4, steady 8th hats, tresillo bass.',
    tags: ['4/4', 'foundation', 'house', 'techno'],
    groove: {
      bpm: 120,
      swing: 0,
      tracks: defaultTracks(),
      theme: 'dark' as ThemeId,
    },
    version: 1,
  },
  {
    id: 'factory-house-groove',
    kind: 'factory',
    name: 'House Groove',
    category: 'House',
    description: 'Classic house rhythm with swung hats and a filtered bassline feel.',
    tags: ['house', '4/4', 'groove'],
    groove: {
      bpm: 126,
      swing: 15,
      tracks: [
        { ...defaultTracks()[0], steps: 16, hits: 4, rotation: 0 },   // kick
        { ...defaultTracks()[1], steps: 16, hits: 2, rotation: 4 },   // snare — backbeat 2&4
        { ...defaultTracks()[2], steps: 16, hits: 8, rotation: 0 },   // hat — 8ths
        { ...defaultTracks()[3], steps: 16, hits: 3, rotation: 0 },   // bass
      ],
      theme: 'neon-void' as ThemeId,
    },
    version: 1,
  },
  {
    id: 'factory-techno-pulse',
    kind: 'factory',
    name: 'Techno Pulse',
    category: 'Techno',
    description: 'Driving techno kick with syncopated hats and a hypnotic bass loop.',
    tags: ['techno', 'hypnotic', 'warehouse'],
    groove: {
      bpm: 130,
      swing: 0,
      tracks: [
        { ...defaultTracks()[0], steps: 16, hits: 5, rotation: 0 },   // kick — off-kilter drive
        { ...defaultTracks()[1], steps: 16, hits: 2, rotation: 8 },   // snare — backbeat
        { ...defaultTracks()[2], steps: 16, hits: 10, rotation: 1 },  // hat — swung 16ths feel
        { ...defaultTracks()[3], steps: 16, hits: 4, rotation: 0 },   // bass — steady pulse
      ],
      theme: 'neon-void' as ThemeId,
    },
    version: 1,
  },
  {
    id: 'factory-breakbeat-amen',
    kind: 'factory',
    name: 'Breakbeat Sketch',
    category: 'Breakbeat',
    description: 'A breakbeat-inspired pattern with dense snare/ghost interplay and rolling hats.',
    tags: ['breakbeat', 'drum-and-bass', 'jungle'],
    groove: {
      bpm: 140,
      swing: 8,
      tracks: [
        { ...defaultTracks()[0], steps: 16, hits: 6, rotation: 2 },   // kick
        { ...defaultTracks()[1], steps: 16, hits: 4, rotation: 0 },   // snare
        { ...defaultTracks()[2], steps: 16, hits: 11, rotation: 0 },  // hat — dense 16ths
        { ...defaultTracks()[3], steps: 16, hits: 5, rotation: 1 },   // bass
      ],
      theme: 'dark-side' as ThemeId,
    },
    version: 1,
  },
  {
    id: 'factory-euclidean-study-1',
    kind: 'factory',
    name: 'Euclidean Study #1 (5,7,11)',
    category: 'Euclidean Studies',
    description: 'Kick 5/16, snare 7/16, hat 11/16 — three coprime pulse streams creating a polymetric bed.',
    tags: ['euclidean', 'polymeter', 'experimental'],
    groove: {
      bpm: 100,
      swing: 0,
      tracks: [
        { ...defaultTracks()[0], steps: 16, hits: 5, rotation: 0 },
        { ...defaultTracks()[1], steps: 16, hits: 7, rotation: 0 },
        { ...defaultTracks()[2], steps: 16, hits: 11, rotation: 0 },
        { ...defaultTracks()[3], steps: 16, hits: 5, rotation: 0 },
      ],
      theme: 'alchemy' as ThemeId,
    },
    version: 1,
  },
  {
    id: 'factory-minimal-pulse',
    kind: 'factory',
    name: 'Minimal Pulse',
    category: 'Techno',
    description: 'Reduced kick pattern, open hats on off-beats, sparse bass. Space is the groove.',
    tags: ['minimal', 'techno', 'deep'],
    groove: {
      bpm: 124,
      swing: 5,
      tracks: [
        { ...defaultTracks()[0], steps: 16, hits: 3, rotation: 0 },   // kick — sparse
        { ...defaultTracks()[1], steps: 16, hits: 1, rotation: 8 },   // snare — just the 4
        { ...defaultTracks()[2], steps: 16, hits: 6, rotation: 2 },   // hat — off-beat accent
        { ...defaultTracks()[3], steps: 16, hits: 2, rotation: 0 },   // bass
      ],
      theme: 'bauhaus' as ThemeId,
    },
    version: 1,
  },
  {
    id: 'factory-syncopated-kick',
    kind: 'factory',
    name: 'Syncopated Kick',
    category: 'Experimental',
    description: 'Kick pattern with heavy syncopation — 7 hits in 16 steps. Snare on 4 & 8. Broken feel.',
    tags: ['syncopation', 'experimental', 'broken-beat'],
    groove: {
      bpm: 115,
      swing: 12,
      tracks: [
        { ...defaultTracks()[0], steps: 16, hits: 7, rotation: 0 },
        { ...defaultTracks()[1], steps: 16, hits: 2, rotation: 6 },
        { ...defaultTracks()[2], steps: 16, hits: 9, rotation: 3 },
        { ...defaultTracks()[3], steps: 16, hits: 4, rotation: 2 },
      ],
      theme: 'candyflip' as ThemeId,
    },
    version: 1,
  },
];

export function getFactoryPresets(): Preset[] {
  return factoryPresets;
}

export function getFactoryPreset(id: string): Preset | undefined {
  return factoryPresets.find((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function cloneGroove(snapshot: GrooveSnapshot): GrooveSnapshot {
  return {
    bpm: snapshot.bpm,
    swing: snapshot.swing,
    theme: snapshot.theme,
    tracks: snapshot.tracks.map((t) => ({ ...t })),
  };
}
