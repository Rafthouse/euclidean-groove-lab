import { describe, it, expect } from 'vitest';
import {
  resolvePitchSpec,
  onsetIndexAt,
  resolveOnset,
  parseNoteToken,
  parseNoteSequence,
  midiToNoteName,
  pitchSequenceToText,
  isPitchedVoice,
} from './pitch';
import type { PitchSequence, HarmonicContext } from './pitch';
import { trackPattern } from './track';
import type { Track } from './track';

const make = (overrides: Partial<Track> = {}): Track => ({
  id: 't',
  name: 'T',
  color: '#fff',
  steps: 16,
  hits: 4,
  rotation: 0,
  mute: false,
  solo: false,
  voiceId: 'bass',
  ...overrides,
});

const seq = (notes: number[], extra: Partial<PitchSequence> = {}): PitchSequence => ({
  id: 's',
  slots: notes.map((midi) => ({ pitch: { kind: 'absolute', midi } })),
  ...extra,
});

describe('resolvePitchSpec', () => {
  it('returns absolute midi directly', () => {
    expect(resolvePitchSpec({ kind: 'absolute', midi: 60 })).toBe(60);
  });

  it('resolves a degree against a major context (1 = tonic)', () => {
    const ctx: HarmonicContext = { root: 60, scale: 'major' };
    expect(resolvePitchSpec({ kind: 'degree', degree: 1 }, ctx)).toBe(60); // C
    expect(resolvePitchSpec({ kind: 'degree', degree: 5 }, ctx)).toBe(67); // G
  });

  it('wraps degrees beyond the scale into the next octave', () => {
    const ctx: HarmonicContext = { root: 60, scale: 'major' };
    expect(resolvePitchSpec({ kind: 'degree', degree: 8 }, ctx)).toBe(72); // C an octave up
  });

  it('applies octaveOffset on top of the degree', () => {
    const ctx: HarmonicContext = { root: 60, scale: 'minor' };
    expect(resolvePitchSpec({ kind: 'degree', degree: 1, octaveOffset: -1 }, ctx)).toBe(48);
  });
});

describe('onsetIndexAt', () => {
  // E(3,8) = [x . . x . . x .] -> onsets at steps 0,3,6 within each 8-step cycle
  const pulses = trackPattern(make({ steps: 8, hits: 3 })).pulses;

  it('counts zero onsets before step 0', () => {
    expect(onsetIndexAt(pulses, 0)).toBe(0);
  });

  it('counts onsets within the first cycle', () => {
    expect(onsetIndexAt(pulses, 1)).toBe(1); // onset at step 0 has fired
    expect(onsetIndexAt(pulses, 4)).toBe(2); // onsets at 0 and 3 fired
    expect(onsetIndexAt(pulses, 7)).toBe(3); // onsets at 0,3,6 fired
  });

  it('accumulates across full cycles (3 onsets per 8-step cycle)', () => {
    expect(onsetIndexAt(pulses, 8)).toBe(3); // one full cycle
    expect(onsetIndexAt(pulses, 16)).toBe(6); // two full cycles
    expect(onsetIndexAt(pulses, 17)).toBe(7);
  });
});

describe('resolveOnset — drum-style (no pitch layer)', () => {
  it('fires every onset with midi undefined and default velocity', () => {
    const t = make({ steps: 8, hits: 3, voiceId: 'kick' });
    const tp = trackPattern(t);
    const r = resolveOnset(t, tp, 0);
    expect(r).not.toBeNull();
    expect(r!.midi).toBeUndefined();
    expect(r!.velocity).toBe(100);
  });

  it('returns null on a silent step', () => {
    const t = make({ steps: 8, hits: 3, voiceId: 'kick' });
    const tp = trackPattern(t);
    expect(resolveOnset(t, tp, 1)).toBeNull(); // step 1 is a rest in E(3,8)
  });
});

describe('resolveOnset — isorhythm (pitch length independent of rhythm)', () => {
  // 3 onsets per cycle, pitch sequence of length 2 -> drifts.
  const t = make({ steps: 8, hits: 3, pitches: seq([60, 64]) });
  const tp = trackPattern(t);

  it('maps each onset to slot (onsetIndex % seqLength)', () => {
    expect(resolveOnset(t, tp, 0)!.midi).toBe(60); // onset 0 -> slot 0
    expect(resolveOnset(t, tp, 3)!.midi).toBe(64); // onset 1 -> slot 1
    expect(resolveOnset(t, tp, 6)!.midi).toBe(60); // onset 2 -> slot 0 (wrap)
  });

  it('continues drifting into the next rhythmic cycle', () => {
    expect(resolveOnset(t, tp, 8)!.midi).toBe(64); // onset 3 -> slot 1
    expect(resolveOnset(t, tp, 11)!.midi).toBe(60); // onset 4 -> slot 0
  });

  it('realigns only after LCM(onsets, seqLen) onsets', () => {
    // LCM(3,2)=6 onsets = 2 full rhythm cycles; onset 6 -> slot 0 again
    expect(resolveOnset(t, tp, 16)!.midi).toBe(60); // onset 6 -> slot 0
  });
});

describe('resolveOnset — rests in the pitch sequence', () => {
  it('returns null for a null slot (sounded onset, no pitch)', () => {
    const pitches: PitchSequence = {
      id: 's',
      slots: [{ pitch: { kind: 'absolute', midi: 60 } }, null, { pitch: { kind: 'absolute', midi: 67 } }],
    };
    const t = make({ steps: 8, hits: 3, pitches });
    const tp = trackPattern(t);
    expect(resolveOnset(t, tp, 0)!.midi).toBe(60); // onset 0
    expect(resolveOnset(t, tp, 3)).toBeNull(); // onset 1 -> rest slot
    expect(resolveOnset(t, tp, 6)!.midi).toBe(67); // onset 2
  });
});

describe('resolveOnset — velocity precedence', () => {
  it('PitchEvent.velocity wins over step accent and default', () => {
    const pitches: PitchSequence = {
      id: 's',
      slots: [{ pitch: { kind: 'absolute', midi: 60 }, velocity: 42 }],
    };
    const t = make({ steps: 8, hits: 3, pitches, velocityEnabled: true, velocityPattern: [90] });
    const tp = trackPattern(t);
    expect(resolveOnset(t, tp, 0)!.velocity).toBe(42);
  });

  it('falls back to TrackPattern.velocities[step] when the event has none', () => {
    const t = make({ steps: 8, hits: 3, pitches: seq([60]), velocityEnabled: true, velocityPattern: [73] });
    const tp = trackPattern(t);
    expect(resolveOnset(t, tp, 0)!.velocity).toBe(73);
  });

  it('falls back to default (100) when neither is set', () => {
    const t = make({ steps: 8, hits: 3, pitches: seq([60]) });
    const tp = trackPattern(t);
    expect(resolveOnset(t, tp, 0)!.velocity).toBe(100);
  });
});

describe('resolveOnset — duration', () => {
  it('passes durationSteps through, defaulting to 1', () => {
    const pitches: PitchSequence = {
      id: 's',
      slots: [{ pitch: { kind: 'absolute', midi: 60 }, durationSteps: 4 }, { pitch: { kind: 'absolute', midi: 62 } }],
    };
    const t = make({ steps: 8, hits: 3, pitches });
    const tp = trackPattern(t);
    expect(resolveOnset(t, tp, 0)!.durationSteps).toBe(4);
    expect(resolveOnset(t, tp, 3)!.durationSteps).toBe(1);
  });
});

describe('parseNoteToken', () => {
  it('parses raw MIDI numbers', () => {
    expect(parseNoteToken('60')).toBe(60);
    expect(parseNoteToken('0')).toBe(0);
    expect(parseNoteToken('127')).toBe(127);
  });

  it('rejects out-of-range MIDI numbers', () => {
    expect(parseNoteToken('128')).toBeNull();
  });

  it('parses note names with C4 = 60', () => {
    expect(parseNoteToken('C4')).toBe(60);
    expect(parseNoteToken('E2')).toBe(40);
    expect(parseNoteToken('A4')).toBe(69);
  });

  it('parses sharps and flats', () => {
    expect(parseNoteToken('C#4')).toBe(61);
    expect(parseNoteToken('Bb3')).toBe(58);
    expect(parseNoteToken('Db4')).toBe(61);
  });

  it('parses negative octaves', () => {
    expect(parseNoteToken('C-1')).toBe(0);
  });

  it('is case-insensitive on the letter', () => {
    expect(parseNoteToken('g3')).toBe(55);
  });

  it('returns null for garbage', () => {
    expect(parseNoteToken('H4')).toBeNull();
    expect(parseNoteToken('xyz')).toBeNull();
    expect(parseNoteToken('')).toBeNull();
  });
});

describe('parseNoteSequence', () => {
  it('parses a mixed name/number line', () => {
    const { slots, errors } = parseNoteSequence('C3 D3 67 Bb3');
    expect(errors).toEqual([]);
    expect(slots.map((s) => (s ? s.pitch : null))).toEqual([
      { kind: 'absolute', midi: 48 },
      { kind: 'absolute', midi: 50 },
      { kind: 'absolute', midi: 67 },
      { kind: 'absolute', midi: 58 },
    ]);
  });

  it('treats -, . and _ as rests', () => {
    const { slots } = parseNoteSequence('C3 - D3 . _');
    expect(slots[1]).toBeNull();
    expect(slots[3]).toBeNull();
    expect(slots[4]).toBeNull();
    expect(slots).toHaveLength(5);
  });

  it('collects unparseable tokens as errors and skips them', () => {
    const { slots, errors } = parseNoteSequence('C3 wat G3');
    expect(errors).toEqual(['wat']);
    expect(slots).toHaveLength(2);
  });

  it('handles comma separators and extra whitespace', () => {
    const { slots } = parseNoteSequence('  C3 ,D3,  E3 ');
    expect(slots).toHaveLength(3);
  });
});

describe('midiToNoteName / round-trip', () => {
  it('formats notes with C4 = 60', () => {
    expect(midiToNoteName(60)).toBe('C4');
    expect(midiToNoteName(40)).toBe('E2');
    expect(midiToNoteName(0)).toBe('C-1');
  });

  it('round-trips name -> midi -> name', () => {
    for (const name of ['C3', 'E2', 'G3', 'A4', 'C-1']) {
      expect(midiToNoteName(parseNoteToken(name)!)).toBe(name);
    }
  });

  it('serializes a sequence to text with rests as dashes', () => {
    const s: PitchSequence = {
      id: 's',
      slots: [{ pitch: { kind: 'absolute', midi: 48 } }, null, { pitch: { kind: 'absolute', midi: 55 } }],
    };
    expect(pitchSequenceToText(s)).toBe('C3 - G3');
  });
});

describe('isPitchedVoice', () => {
  it('treats bass as pitched', () => {
    expect(isPitchedVoice('bass')).toBe(true);
  });

  it('treats drum voices as not pitched', () => {
    expect(isPitchedVoice('kick')).toBe(false);
    expect(isPitchedVoice('snare')).toBe(false);
    expect(isPitchedVoice('hat')).toBe(false);
  });
});
