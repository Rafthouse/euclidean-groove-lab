import { describe, it, expect } from 'vitest';
import { renderMidi, serializeMidi, GM_DRUM_MAP } from './midi';
import { defaultTracks } from './track';
import type { Track } from './track';

const make = (overrides: Partial<Track> = {}): Track => ({
  id: 't', name: 'T', color: '#fff',
  steps: 8, hits: 4, rotation: 0,
  mute: false, solo: false, voiceId: 'kick',
  ...overrides,
});

/** Find the index of a byte subsequence, or -1. */
function indexOfSeq(haystack: Uint8Array, needle: number[]): number {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

function countSeq(haystack: Uint8Array, needle: number[]): number {
  let n = 0;
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    let hit = true;
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) { hit = false; break; }
    if (hit) n++;
  }
  return n;
}

const MThd = [0x4d, 0x54, 0x68, 0x64];
const MTrk = [0x4d, 0x54, 0x72, 0x6b];

describe('renderMidi — structure', () => {
  it('is deterministic (same inputs -> deep-equal project)', () => {
    const a = renderMidi(defaultTracks(), 2, 120);
    const b = renderMidi(defaultTracks(), 2, 120);
    expect(a).toEqual(b);
  });

  it('produces one MidiTrack per Groove Lab track, format 1, PPQ 96', () => {
    const p = renderMidi(defaultTracks(), 2, 120);
    expect(p.format).toBe(1);
    expect(p.ticksPerQuarter).toBe(96);
    expect(p.tracks).toHaveLength(4);
    expect(p.bpm).toBe(120);
  });

  it('drum voices land on channel 9 (GM ch10) with their GM notes', () => {
    const p = renderMidi([make({ voiceId: 'kick', name: 'Kick' })], 1, 120);
    const t = p.tracks[0];
    expect(t.channel).toBe(9);
    expect(t.notes.every((n) => n.channel === 9)).toBe(true);
    expect(t.notes.every((n) => n.note === GM_DRUM_MAP.kick)).toBe(true);
  });

  it('a pitched voice (bass) lands on a melodic channel with its resolved pitches', () => {
    const bass = make({
      voiceId: 'bass', name: 'Bass', steps: 8, hits: 4,
      pitches: { id: 'p', slots: [
        { pitch: { kind: 'absolute', midi: 48 } },
        { pitch: { kind: 'absolute', midi: 52 } },
      ] },
    });
    const p = renderMidi([bass], 1, 120); // 16 steps over an 8-step track = 8 onsets
    const t = p.tracks[0];
    expect(t.channel).toBe(0);
    expect(t.notes).toHaveLength(8);
    expect(t.notes.map((n) => n.note)).toEqual([48, 52, 48, 52, 48, 52, 48, 52]);
  });

  it('a bass with no pitch layer exports its intrinsic fallback note (E2 = 40)', () => {
    const p = renderMidi([make({ voiceId: 'bass', name: 'Bass', steps: 8, hits: 4 })], 1, 120);
    expect(p.tracks[0].channel).toBe(0);
    expect(p.tracks[0].notes.every((n) => n.note === 40)).toBe(true);
  });

  it('rest slots in a pitch sequence are excluded from the export', () => {
    const bass = make({
      voiceId: 'bass', name: 'Bass', steps: 8, hits: 4,
      pitches: { id: 'p', slots: [
        { pitch: { kind: 'absolute', midi: 48 } },
        null,
        { pitch: { kind: 'absolute', midi: 55 } },
      ] },
    });
    const p = renderMidi([bass], 1, 120); // 8 onsets over an 8-step track
    const t = p.tracks[0];
    // onset idx 0..7 -> slot idx%3 = [0,1,2,0,1,2,0,1]; slot 1 is a rest.
    // Rests fall on onset idx 1,4,7 (3 rests) -> 5 notes emitted.
    expect(t.notes).toHaveLength(5);
    expect(t.notes.map((n) => n.note)).toEqual([48, 55, 48, 55, 48]);
  });

  it('manual mute overlay excludes muted onsets from the export', () => {
    // kick E(4,8) -> onsets at local steps 0,2,4,6. Mute local step 2.
    const mask = [false, false, true, false, false, false, false, false];
    const plain = renderMidi([make({ voiceId: 'kick', steps: 8, hits: 4 })], 1, 120);
    const muted = renderMidi([make({ voiceId: 'kick', steps: 8, hits: 4, manualMute: mask })], 1, 120);
    // 1 bar over an 8-step track = 8 onsets; local step 2 recurs at global 2 and 10.
    expect(plain.tracks[0].notes).toHaveLength(8);
    expect(muted.tracks[0].notes).toHaveLength(6);
    // none of the surviving notes start on a muted step (ticks 2*24 or 10*24)
    const mutedTicks = muted.tracks[0].notes.map((n) => n.startTick);
    expect(mutedTicks).not.toContain(2 * 24);
    expect(mutedTicks).not.toContain(10 * 24);
  });

  it('ticks: 16th-note grid maps to 24 ticks/step; default velocity 100 -> 127', () => {
    const p = renderMidi([make({ voiceId: 'kick', steps: 8, hits: 4 })], 1, 120);
    const first = p.tracks[0].notes[0];
    expect(first.startTick).toBe(0);
    expect(p.tracks[0].notes[1].startTick).toBe(2 * 24); // onset at step 2
    expect(first.velocity).toBe(127);
    expect(first.durationTicks).toBe(24);
  });
});

describe('serializeMidi — Standard MIDI File bytes', () => {
  const project = renderMidi(defaultTracks(), 2, 120);
  const bytes = serializeMidi(project);

  it('starts with a valid MThd header: format 1, ntrks = tracks + 1, division 96', () => {
    expect(Array.from(bytes.slice(0, 4))).toEqual(MThd);
    expect(Array.from(bytes.slice(4, 8))).toEqual([0, 0, 0, 6]); // header length
    expect(Array.from(bytes.slice(8, 10))).toEqual([0, 1]); // format 1
    expect(Array.from(bytes.slice(10, 12))).toEqual([0, 5]); // 4 tracks + conductor
    expect(Array.from(bytes.slice(12, 14))).toEqual([0, 96]); // division
  });

  it('contains exactly ntrks MTrk chunks (conductor + one per track)', () => {
    expect(countSeq(bytes, MTrk)).toBe(5);
  });

  it('contains a tempo meta event for 120 BPM (500000 us/qn = 07 A1 20)', () => {
    // FF 51 03 07 A1 20
    expect(indexOfSeq(bytes, [0xff, 0x51, 0x03, 0x07, 0xa1, 0x20])).toBeGreaterThanOrEqual(0);
  });

  it('ends every track with End Of Track (FF 2F 00)', () => {
    expect(countSeq(bytes, [0xff, 0x2f, 0x00])).toBe(5); // one per chunk
  });

  it('is deterministic: serialize twice -> byte-identical', () => {
    const a = serializeMidi(renderMidi(defaultTracks(), 2, 120));
    const b = serializeMidi(renderMidi(defaultTracks(), 2, 120));
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('encodes a different tempo correctly (140 BPM)', () => {
    const mpq = Math.round(60000000 / 140); // 428571 = 0x0688BB
    const b = serializeMidi(renderMidi(defaultTracks(), 1, 140));
    expect(indexOfSeq(b, [0xff, 0x51, 0x03, (mpq >> 16) & 0xff, (mpq >> 8) & 0xff, mpq & 0xff]))
      .toBeGreaterThanOrEqual(0);
  });
});
