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
  | 'nautilus' | 'brownie' | 'beeswax' | 'club-culture'
  | 'revelation' | 'high-contrast' | 'candyflip' | 'barbie'
  | 'alchemy' | 'beekeeper';

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
  | 'Pure Euclidean'
  | 'Clave Rotations'
  | 'African Timelines'
  | 'Arabic Rhythms'
  | 'Euclidean Library'
  | 'User'
  | 'Uncategorised';

export const FACTORY_CATEGORIES: PresetCategory[] = [
  'Basic',
  'House',
  'Techno',
  'Breakbeat',
  'Experimental',
  'Euclidean Studies',
  'Pure Euclidean',
  'Clave Rotations',
  'African Timelines',
  'Arabic Rhythms',
  'Euclidean Library',
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

/** Build a single track for a historical preset. Keeps voiceId, steps, hits, rotation,
 *  velocity, volume. All other fields come from defaultTracks() for the voice. */
function histTrack(
  voiceIndex: number,
  steps: number,
  hits: number,
  rotation: number,
  velocity?: number[],
): Track {
  return {
    ...defaultTracks()[voiceIndex],
    steps,
    hits,
    rotation,
    ...(velocity ? { velocity } : {}),
  };
}

let factoryPresets: Preset[] = [
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

/* Historical presets are added at first call via getFactoryPresets(). */
let _historicalHydrated = false;

export function getFactoryPresets(): Preset[] {
  hydrateHistoricalPresets();
  return factoryPresets;
}

function hydrateHistoricalPresets(): void {
  if (_historicalHydrated) return;
  _historicalHydrated = true;

  const historical: { id: string; name: string; category: PresetCategory; desc: string; tags: string[]; tracks: { vi: number; s: number; h: number; r: number; v?: number[] }[]; theme: ThemeId }[] = [
    { id: 'hist-shiko', name: 'Shiko Kit', category: 'Euclidean Studies', desc: 'Afro-Cuban hybrid from Shiko rhythm [4-2-4-2-4]', tags: ['afro-cuban', 'shiko', 'historical'], theme: 'dark', tracks: [{vi:0,s:16,h:3,r:0},{vi:1,s:16,h:1,r:5},{vi:2,s:16,h:8,r:0,v:[100,85,100,85,100,85,100,85]},{vi:3,s:16,h:1,r:3}] },
    { id: 'hist-clave-son', name: 'Clave Son Kit', category: 'Euclidean Studies', desc: 'Afro-Cuban foundation [3-3-4-2-4] - Bo Diddley beat', tags: ['afro-cuban', 'clave', 'son', 'historical'], theme: 'paper', tracks: [{vi:0,s:16,h:4,r:0},{vi:1,s:16,h:3,r:-4},{vi:2,s:16,h:8,r:0,v:[100,85,100,85,100,85,100,85]},{vi:3,s:16,h:3,r:1}] },
    { id: 'hist-tresillo', name: 'Tresillo Kit', category: 'Euclidean Studies', desc: 'Cuban Tresillo foundation [3-3-2] - reggaeton core', tags: ['cuban', 'tresillo', 'reggaeton', 'historical'], theme: 'elements', tracks: [{vi:0,s:8,h:3,r:0},{vi:1,s:8,h:3,r:1},{vi:2,s:8,h:4,r:0,v:[100,80,100,80]},{vi:3,s:8,h:2,r:0}] },
    { id: 'hist-bossa-nova', name: 'Bossa Nova Kit', category: 'Euclidean Studies', desc: 'Brazilian groove [3-3-4-3-3]', tags: ['brazilian', 'bossa-nova', 'historical'], theme: 'brownie', tracks: [{vi:0,s:16,h:5,r:0},{vi:1,s:16,h:2,r:6},{vi:2,s:16,h:8,r:2,v:[100,90,100,85,100,90,100,85]},{vi:3,s:16,h:3,r:0}] },
    { id: 'hist-west-african-bell', name: 'West African Bell Kit', category: 'Euclidean Studies', desc: '12-pulse bell pattern [2-1-2-2-1-2-2]', tags: ['west-african', 'bell', '12-pulse', 'historical'], theme: 'military', tracks: [{vi:0,s:12,h:5,r:0},{vi:1,s:12,h:5,r:1},{vi:2,s:12,h:6,r:0,v:[100,85,95,80,100,90]},{vi:3,s:12,h:4,r:0}] },
    { id: 'hist-gahu', name: 'Gahu Kit', category: 'Euclidean Studies', desc: 'Ewe people rhythm [3-3-4-4-2]', tags: ['ewe', 'west-african', 'gahu', 'historical'], theme: 'smoke-dub', tracks: [{vi:0,s:16,h:5,r:0},{vi:1,s:16,h:2,r:4},{vi:2,s:16,h:8,r:0,v:[100,80,85,95,100,85,90,100]},{vi:3,s:16,h:2,r:0}] },
    { id: 'hist-soukous', name: 'Soukous Kit', category: 'Euclidean Studies', desc: 'Congolese rhythm [3-3-4-1-5]', tags: ['congolese', 'soukous', 'historical'], theme: 'big-boss', tracks: [{vi:0,s:16,h:5,r:0},{vi:1,s:16,h:4,r:2},{vi:2,s:16,h:8,r:0},{vi:3,s:16,h:3,r:0}] },
  ];

  for (const h of historical) {
    if (factoryPresets.find((p) => p.id === h.id)) continue;
    factoryPresets.push({
      id: h.id,
      kind: 'factory',
      name: h.name,
      category: h.category,
      description: h.desc,
      tags: h.tags,
      groove: {
        bpm: 120,
        swing: 0,
        tracks: h.tracks.map((t) => histTrack(t.vi, t.s, t.h, t.r, t.v)),
        theme: h.theme,
      },
      version: 1,
    });
  }

  /* ── Pure Euclidean pulse collection ── */
  const pureEuclidean: { id: string; name: string; desc: string; tags: string[]; s: number; h: number; r: number }[] = [
    { id: 'euclid-2-5',  name: 'E(2,5)',  desc: 'x . x . .',          tags: ['pure-euclidean', '5-step'],        s: 5,  h: 2, r: 0 },
    { id: 'euclid-2-7',  name: 'E(2,7)',  desc: 'x . . x . . .',      tags: ['pure-euclidean', '7-step'],        s: 7,  h: 2, r: 0 },
    { id: 'euclid-3-7',  name: 'E(3,7)',  desc: 'x . x . x . .',      tags: ['pure-euclidean', '7-step'],        s: 7,  h: 3, r: 0 },
    { id: 'euclid-3-8',  name: 'Tresillo', desc: 'E(3,8) — tresillo foundation: x . . x . . x .',    tags: ['pure-euclidean', 'tresillo', '8-step'],   s: 8,  h: 3, r: 0 },
    { id: 'euclid-3-10', name: 'E(3,10)', desc: 'x . . x . . x . . .', tags: ['pure-euclidean', '10-step'],       s: 10, h: 3, r: 0 },
    { id: 'euclid-3-11', name: 'E(3,11)', desc: 'x . . . x . . . x . .', tags: ['pure-euclidean', '11-step'],     s: 11, h: 3, r: 0 },
    { id: 'euclid-3-14', name: 'E(3,14)', desc: 'x . . . . x . . . . x . . .', tags: ['pure-euclidean', '14-step'], s: 14, h: 3, r: 0 },
    { id: 'euclid-5-16', name: 'E(5,16)', desc: 'Son Clave prototype — x . . x . . x . . x . . x . . .', tags: ['pure-euclidean', '16-step', 'son-clave-family'], s: 16, h: 5, r: 0 },
    { id: 'euclid-5-12', name: 'E(5,12)', desc: 'Fume-Fume prototype — x . x . x . . x . x . .',      tags: ['pure-euclidean', '12-step'],       s: 12, h: 5, r: 0 },
    { id: 'euclid-7-12', name: 'E(7,12)', desc: 'Bembé prototype — x . x . x x . x . x x .',           tags: ['pure-euclidean', '12-step'],       s: 12, h: 7, r: 0 },
  ];
  for (const e of pureEuclidean) {
    if (factoryPresets.find((p) => p.id === e.id)) continue;
    factoryPresets.push({
      id: e.id,
      kind: 'factory',
      name: e.name,
      category: 'Pure Euclidean',
      description: e.desc,
      tags: e.tags,
      groove: {
        bpm: 120,
        swing: 0,
        tracks: [
          histTrack(0, e.s, e.h, e.r),
          histTrack(1, 1, 0, 0),
          histTrack(2, 1, 0, 0),
          histTrack(3, 1, 0, 0),
        ],
        theme: 'dark' as ThemeId,
      },
      version: 1,
    });
  }

  /* ── Clave Rotations — Son Clave 3-2 and 2-3 ── */
  const claveRotations: { id: string; name: string; desc: string; s: number; h: number; r: number; theme: ThemeId }[] = [
    { id: 'clave-son-3-2', name: 'Son Clave 3-2', desc: 'E(5,16) R0 — the standard son clave, 3-side first.', s: 16, h: 5, r: 0, theme: 'paper' },
    { id: 'clave-son-2-3', name: 'Son Clave 2-3', desc: 'E(5,16) R8 — son clave reversed, 2-side first.',    s: 16, h: 5, r: 8, theme: 'paper' },
  ];
  for (const c of claveRotations) {
    if (factoryPresets.find((p) => p.id === c.id)) continue;
    factoryPresets.push({
      id: c.id,
      kind: 'factory',
      name: c.name,
      category: 'Clave Rotations',
      description: c.desc,
      tags: ['clave', 'rotation', 'son-clave'],
      groove: {
        bpm: 120,
        swing: 0,
        tracks: [
          histTrack(0, c.s, c.h, c.r),
          histTrack(1, c.s, c.h, c.r ^ (c.r === 0 ? 8 : 0)), // inverse rotation on snare
          histTrack(2, c.s, Math.floor(c.h * 1.6), 0),
          histTrack(3, c.s, Math.ceil(c.h * 0.6), 0),
        ],
        theme: c.theme,
      },
      version: 1,
    });
  }

  /* ── African Timelines ── */
  /* ── African Timelines ── */
  // Each track entry can optionally carry a velocity array.
  type AfrTrack = { vi: number; s: number; h: number; r: number; v?: number[] };
  const africanTimelines: { id: string; name: string; desc: string; tags: string[]; tracks: AfrTrack[]; theme: ThemeId }[] = [
    { id: 'african-fume-fume', name: 'Fume-Fume', desc: 'West African timeline [2-2-3-2-3] — E(5,12) R0', tags: ['african', 'timeline', 'fume-fume', '12-step'],
      tracks: [{vi:0,s:12,h:5,r:0},{vi:1,s:12,h:2,r:6},{vi:2,s:12,h:4,r:0},{vi:3,s:12,h:3,r:3}], theme: 'military' },
    { id: 'african-bembe', name: 'Bembe', desc: 'West African timeline [2-2-1-2-2-2-1] — E(7,12) R0', tags: ['african', 'timeline', 'bembe', '12-step'],
      tracks: [{vi:0,s:12,h:7,r:0},{vi:1,s:12,h:2,r:0},{vi:2,s:12,h:4,r:0,v:[100,85]},{vi:3,s:12,h:3,r:2}], theme: 'elements' },
    { id: 'african-nandon-bawaa', name: 'Nandon Bawaa', desc: 'Tresillo rotation — E(3,8) R2', tags: ['african', 'timeline', 'tresillo-rotation', '8-step'],
      tracks: [{vi:0,s:8,h:3,r:2},{vi:1,s:8,h:3,r:0},{vi:2,s:8,h:2,r:0},{vi:3,s:8,h:1,r:1}], theme: 'old-school' },
    { id: 'african-adowa', name: 'Adowa', desc: 'Akan people — two Tresillo layers: E(3,8) R0 + E(3,8) R1', tags: ['african', 'timeline', 'adowa', 'akan', '8-step'],
      tracks: [{vi:0,s:8,h:3,r:0},{vi:1,s:8,h:3,r:1},{vi:2,s:8,h:2,r:0},{vi:3,s:8,h:2,r:2}], theme: 'military' },
  ];
  for (const a of africanTimelines) {
    if (factoryPresets.find((p) => p.id === a.id)) continue;
    factoryPresets.push({
      id: a.id,
      kind: 'factory',
      name: a.name,
      category: 'African Timelines',
      description: a.desc,
      tags: a.tags,
      groove: {
        bpm: 120,
        swing: 0,
        tracks: a.tracks.map((t) => histTrack(t.vi, t.s, t.h, t.r, t.v)),
        theme: a.theme,
      },
      version: 1,
    });
  }

  /* ── Arabic Rhythms ── */
  const arabic: { id: string; name: string; desc: string; s: number; h: number; r: number; theme: ThemeId }[] = [
    { id: 'arabic-al-thaqil-al-awwal', name: 'Al-Thaqīl al-Awwal', desc: 'Classical Arabic meter — 5 notes in 16, heavy feel. Described via Safi al-Din mnemonic system.', s: 16, h: 5, r: 0, theme: 'revelation' },
  ];
  for (const ar of arabic) {
    if (factoryPresets.find((p) => p.id === ar.id)) continue;
    factoryPresets.push({
      id: ar.id,
      kind: 'factory',
      name: ar.name,
      category: 'Arabic Rhythms',
      description: ar.desc,
      tags: ['arabic', 'classical', 'al-thaqil'],
      groove: {
        bpm: 90,
        swing: 0,
        tracks: [
          histTrack(0, ar.s, ar.h, ar.r),
          histTrack(1, ar.s, Math.floor(ar.h * 0.4), 0),
          histTrack(2, ar.s, Math.ceil(ar.h * 1.4), 0),
          histTrack(3, ar.s, Math.ceil(ar.h * 0.6), 2),
        ],
        theme: ar.theme,
      },
      version: 1,
    });
  }

  /* ── Euclidean Library — comprehensive single-voice patterns ── */
  type RhLib = { id: string; n: string; s: number; h: number; r: number };
  const lib: RhLib[] = [
    { id:'rl-pendulum',        n:'Pendulum',        s:5,  h:2, r:0 },
    { id:'rl-long-swing',      n:'Long Swing',      s:7,  h:2, r:0 },
    { id:'rl-triangle',        n:'Triangle',        s:7,  h:3, r:0 },
    { id:'rl-tresillo',        n:'Tresillo',        s:8,  h:3, r:0 },
    { id:'rl-orbit',           n:'Orbit',           s:8,  h:3, r:1 },
    { id:'rl-nandon-bawaa',    n:'Nandon Bawaa',    s:8,  h:3, r:2 },
    { id:'rl-sparse-tresillo', n:'Sparse Tresillo', s:10, h:3, r:0 },
    { id:'rl-dry-season',      n:'Dry Season',      s:11, h:3, r:0 },
    { id:'rl-horizon',         n:'Horizon',         s:14, h:3, r:0 },
    { id:'rl-caravan',         n:'Caravan',         s:9,  h:4, r:0 },
    { id:'rl-stepper',         n:'Stepper',         s:11, h:4, r:0 },
    { id:'rl-marchline',       n:'Marchline',       s:12, h:4, r:0 },
    { id:'rl-crooked-road',    n:'Crooked Road',    s:13, h:4, r:0 },
    { id:'rl-drift',           n:'Drift',           s:15, h:4, r:0 },
    { id:'rl-engine',          n:'Engine',          s:9,  h:5, r:0 },
    { id:'rl-spring',          n:'Spring',          s:11, h:5, r:0 },
    { id:'rl-fume-fume',       n:'Fume-Fume',       s:12, h:5, r:0 },
    { id:'rl-wavepath',        n:'Wavepath',        s:13, h:5, r:0 },
    { id:'rl-tilt',            n:'Tilt',            s:14, h:5, r:0 },
    { id:'rl-son-clave-3-2',   n:'Son Clave 3-2',   s:16, h:5, r:0 },
    { id:'rl-son-clave-2-3',   n:'Son Clave 2-3',   s:16, h:5, r:8 },
    { id:'rl-bossa-clave',     n:'Bossa Clave',     s:16, h:5, r:4 },
    { id:'rl-rumba-clave',     n:'Rumba Clave',     s:16, h:5, r:12 },
    { id:'rl-cinquillo',       n:'Cinquillo',       s:16, h:5, r:2 },
    { id:'rl-echo-clave',      n:'Echo Clave',      s:16, h:5, r:6 },
    { id:'rl-reverse-clave',   n:'Reverse Clave',   s:16, h:5, r:10 },
    { id:'rl-shadow-clave',    n:'Shadow Clave',    s:16, h:5, r:14 },
    { id:'rl-bembe',           n:'Bembe',           s:12, h:7, r:0 },
    { id:'rl-bembe-orbit',     n:'Bembe Orbit',     s:12, h:7, r:1 },
    { id:'rl-bembe-spiral',    n:'Bembe Spiral',    s:12, h:7, r:2 },
    { id:'rl-bembe-current',   n:'Bembe Current',   s:12, h:7, r:3 },
    { id:'rl-bembe-flow',      n:'Bembe Flow',      s:12, h:7, r:4 },
    { id:'rl-bembe-pulse',     n:'Bembe Pulse',     s:12, h:7, r:5 },
    { id:'rl-bembe-return',    n:'Bembe Return',    s:12, h:7, r:6 },
    { id:'rl-locomotive',      n:'Locomotive',      s:15, h:7, r:0 },
    { id:'rl-conveyor',        n:'Conveyor',        s:16, h:7, r:0 },
    { id:'rl-crosswind',       n:'Crosswind',       s:17, h:7, r:0 },
    { id:'rl-dual-pulse',      n:'Dual Pulse',      s:15, h:8, r:0 },
    { id:'rl-tightrope',       n:'Tightrope',       s:17, h:8, r:0 },
    { id:'rl-swarm',           n:'Swarm',           s:16, h:9, r:0 },
    { id:'rl-hive',            n:'Hive',            s:17, h:9, r:0 },
    { id:'rl-migration',       n:'Migration',       s:19, h:9, r:0 },
    { id:'rl-monsoon',         n:'Monsoon',         s:16, h:11, r:0 },
    { id:'rl-rainforest',      n:'Rainforest',      s:24, h:11, r:0 },
    { id:'rl-rapids',          n:'Rapids',          s:24, h:13, r:0 },
    { id:'rl-torrent',         n:'Torrent',         s:24, h:15, r:0 },
    { id:'rl-moonwalk', n:'Moonwalk', s:18, h:3, r:0 },
    { id:'rl-distant-fires', n:'Distant Fires', s:20, h:3, r:0 },
    { id:'rl-mirage', n:'Mirage', s:22, h:3, r:0 },
    { id:'rl-nomad', n:'Nomad', s:24, h:3, r:0 },
    { id:'rl-signal', n:'Signal', s:18, h:4, r:0 },
    { id:'rl-watchtower', n:'Watchtower', s:20, h:4, r:0 },
    { id:'rl-dust-trail', n:'Dust Trail', s:22, h:4, r:0 },
    { id:'rl-frontier', n:'Frontier', s:24, h:4, r:0 },
    { id:'rl-pulse-engine', n:'Pulse Engine', s:18, h:5, r:0 },
    { id:'rl-tidal', n:'Tidal', s:20, h:5, r:0 },
    { id:'rl-crosscurrent', n:'Crosscurrent', s:22, h:5, r:0 },
    { id:'rl-wake', n:'Wake', s:24, h:5, r:0 },
    { id:'rl-gearbox', n:'Gearbox', s:18, h:6, r:0 },
    { id:'rl-flywheel', n:'Flywheel', s:20, h:6, r:0 },
    { id:'rl-machinery', n:'Machinery', s:22, h:6, r:0 },
    { id:'rl-piston', n:'Piston', s:24, h:6, r:0 },
    { id:'rl-riverbed', n:'Riverbed', s:18, h:7, r:0 },
    { id:'rl-delta', n:'Delta', s:20, h:7, r:0 },
    { id:'rl-undertow', n:'Undertow', s:22, h:7, r:0 },
    { id:'rl-floodplain', n:'Floodplain', s:24, h:7, r:0 },
    { id:'rl-helix', n:'Helix', s:18, h:8, r:0 },
    { id:'rl-gyroscope', n:'Gyroscope', s:20, h:8, r:0 },
    { id:'rl-spiral-drive', n:'Spiral Drive', s:22, h:8, r:0 },
    { id:'rl-orbit-ring', n:'Orbit Ring', s:24, h:8, r:0 },
    { id:'rl-hive-core', n:'Hive Core', s:18, h:9, r:0 },
    { id:'rl-swarm-grid', n:'Swarm Grid', s:20, h:9, r:0 },
    { id:'rl-colony', n:'Colony', s:22, h:9, r:0 },
    { id:'rl-nest', n:'Nest', s:24, h:9, r:0 },
    { id:'rl-monsoon-gate', n:'Monsoon Gate', s:18, h:10, r:0 },
    { id:'rl-rain-pulse', n:'Rain Pulse', s:20, h:10, r:0 },
    { id:'rl-storm-front', n:'Storm Front', s:22, h:10, r:0 },
    { id:'rl-cloudbreak', n:'Cloudbreak', s:24, h:10, r:0 },
    { id:'rl-canopy', n:'Canopy', s:18, h:11, r:0 },
    { id:'rl-mangrove', n:'Mangrove', s:20, h:11, r:0 },
    { id:'rl-jungle-path', n:'Jungle Path', s:22, h:11, r:0 },
    { id:'rl-rainforest-core', n:'Rainforest Core', s:24, h:11, r:0 },
    { id:'rl-rapids-north', n:'Rapids North', s:18, h:12, r:0 },
    { id:'rl-rapids-south', n:'Rapids South', s:20, h:12, r:0 },
    { id:'rl-whitewater', n:'Whitewater', s:22, h:12, r:0 },
    { id:'rl-cascade', n:'Cascade', s:24, h:12, r:0 },
    { id:'rl-torrent-alpha', n:'Torrent Alpha', s:18, h:13, r:0 },
    { id:'rl-torrent-beta', n:'Torrent Beta', s:20, h:13, r:0 },
    { id:'rl-torrent-gamma', n:'Torrent Gamma', s:22, h:13, r:0 },
    { id:'rl-torrent-delta', n:'Torrent Delta', s:24, h:13, r:0 },
    { id:'rl-overgrowth', n:'Overgrowth', s:18, h:14, r:0 },
    { id:'rl-wildwood', n:'Wildwood', s:20, h:14, r:0 },
    { id:'rl-thicket', n:'Thicket', s:22, h:14, r:0 },
    { id:'rl-green-maze', n:'Green Maze', s:24, h:14, r:0 },
    { id:'rl-saturation', n:'Saturation', s:24, h:15, r:0 },
    { id:'rl-critical-mass', n:'Critical Mass', s:24, h:16, r:0 },
  ];
  for (const x of lib) {
    if (factoryPresets.find((p) => p.id === x.id)) continue;
    factoryPresets.push({
      id: x.id,
      kind: 'factory',
      name: x.n,
      category: 'Euclidean Library',
      description: x.n + ' — E(' + x.h + ',' + x.s + ') R' + x.r,
      tags: ['euclidean-library'],
      groove: {
        bpm: 120,
        swing: 0,
        tracks: [
          histTrack(0, x.s, x.h, x.r),
          histTrack(1, 1, 0, 0),
          histTrack(2, 1, 0, 0),
          histTrack(3, 1, 0, 0),
        ],
        theme: 'dark' as ThemeId,
      },
      version: 1,
    });
  }
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
