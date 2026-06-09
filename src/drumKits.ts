/**
 * Drum kit registry — the single source of truth for available sample sets.
 *
 * To add a new kit: add one entry below, place three WAV files in
 * `public/samples/<id>/`, and the UI picker picks it up automatically
 * (iterates Object.values(DRUM_KITS)).
 */
export interface DrumKit {
  id: string;
  name: string;
  description: string;
  kick: string;
  snare: string;
  hat: string;
}

export const DRUM_KITS = {
  cr78: {
    id: 'cr78',
    name: 'CR-78',
    description: 'Roland CR-78 CompuRhythm — vintage analog (1978)',
    kick: 'cr78/kick.wav',
    snare: 'cr78/snare.wav',
    hat: 'cr78/hihat.wav',
  },
  kit8: {
    id: 'kit8',
    name: 'Kit-8',
    description: 'Clean electronic kit — Chromium demo samples',
    kick: 'kit8/kick.wav',
    snare: 'kit8/snare.wav',
    hat: 'kit8/hihat.wav',
  },
  kpr77: {
    id: 'kpr77',
    name: 'KPR-77',
    description: 'Korg KPR-77 — analog rhythm machine',
    kick: 'kpr77/kick.wav',
    snare: 'kpr77/snare.wav',
    hat: 'kpr77/hihat.wav',
  },
} as const;

export type DrumKitId = keyof typeof DRUM_KITS;