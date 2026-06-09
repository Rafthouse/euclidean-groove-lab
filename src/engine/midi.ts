/**
 * MIDI export — a SECOND renderer of the same resolved-onset stream that the
 * audio layer plays, so a `.mid` matches what you hear. Two pure stages:
 *
 *   renderMidi(tracks, bars, bpm) -> MidiProject   (data only, no bytes)
 *   serializeMidi(project)        -> Uint8Array     (Standard MIDI File, Format 1)
 *
 * No external dependencies, no DOM, no Blob (the download lives in the UI).
 * Standard MIDI File Format 1: track 0 is a tempo/meta conductor; each Groove
 * Lab track becomes its own MTrk so a DAW can mute/replace voices individually.
 */
import type { Track, VoiceId } from './track';
import { trackPattern } from './track';
import { resolveOnset, isPitchedVoice } from './pitch';

const TICKS_PER_QUARTER = 96;
const TICKS_PER_SIXTEENTH = TICKS_PER_QUARTER / 4; // 24
const STEPS_PER_BAR = 16; // 4/4 assumed
const DRUM_CHANNEL = 9; // GM percussion = channel 10, 0-based
/** Bass voice's intrinsic fallback note (E2 = 40) when it has no pitch layer. */
const DEFAULT_PITCHED_NOTE = 40;

/** General MIDI percussion notes for drum voices (channel 10). */
export const GM_DRUM_MAP: Record<VoiceId, number> = {
  kick: 36, // Bass Drum 1
  snare: 38, // Acoustic Snare
  hat: 42, // Closed Hi-Hat
  bass: 36, // never used (bass is pitched); present to satisfy the record
};

// ── Intermediate representation (pure data) ───────────────────────────────────

export interface MidiNoteEvent {
  startTick: number;
  durationTicks: number;
  channel: number; // 0–15
  note: number; // 0–127
  velocity: number; // 1–127
}

export interface MidiTrackData {
  name: string;
  channel: number;
  notes: MidiNoteEvent[];
}

export interface MidiProject {
  format: 1;
  ticksPerQuarter: number;
  bpm: number;
  /** One per Groove Lab track; the tempo/meta conductor is track 0 at serialize time. */
  tracks: MidiTrackData[];
}

/** Map our 0–100 velocity onto MIDI 1–127. */
function toMidiVelocity(v: number): number {
  return Math.max(1, Math.min(127, Math.round((v / 100) * 127)));
}

/**
 * Render N bars of the current track set into a MidiProject. Mirrors the audio
 * scheduler exactly: pitched voices go through resolveOnset() (pitch + rests +
 * velocity precedence); drum voices are purely rhythmic (pulse + step accent,
 * GM note). Deterministic: same inputs always produce the same project.
 */
export function renderMidi(tracks: Track[], bars: number, bpm: number): MidiProject {
  const totalSteps = bars * STEPS_PER_BAR;

  // Melodic tracks each get their own channel; drums share channel 10.
  let nextMelodic = 0;
  const allocMelodicChannel = (): number => {
    if (nextMelodic === DRUM_CHANNEL) nextMelodic++;
    return nextMelodic++;
  };

  const midiTracks: MidiTrackData[] = tracks.map((track) => {
    const tp = trackPattern(track);
    const pitched = isPitchedVoice(track.voiceId);
    const channel = pitched ? allocMelodicChannel() : DRUM_CHANNEL;
    const notes: MidiNoteEvent[] = [];

    for (let step = 0; step < totalSteps; step++) {
      if (pitched) {
        const onset = resolveOnset(track, tp, step);
        if (!onset || onset.velocity <= 0) continue;
        notes.push({
          startTick: step * TICKS_PER_SIXTEENTH,
          durationTicks: (onset.durationSteps || 1) * TICKS_PER_SIXTEENTH,
          channel,
          note: onset.midi ?? DEFAULT_PITCHED_NOTE,
          velocity: toMidiVelocity(onset.velocity),
        });
      } else {
        const localStep = step % track.steps;
        if (!tp.pulses[localStep]) continue;
        const vel = tp.velocities ? tp.velocities[localStep] ?? 100 : 100;
        if (vel <= 0) continue;
        notes.push({
          startTick: step * TICKS_PER_SIXTEENTH,
          durationTicks: TICKS_PER_SIXTEENTH,
          channel,
          note: GM_DRUM_MAP[track.voiceId],
          velocity: toMidiVelocity(vel),
        });
      }
    }

    return { name: track.name, channel, notes };
  });

  return { format: 1, ticksPerQuarter: TICKS_PER_QUARTER, bpm, tracks: midiTracks };
}

// ── Serializer (Standard MIDI File, Format 1) ─────────────────────────────────

/** Variable-length quantity (big-endian, 7 bits/byte, high bit = continue). */
function vlq(value: number): number[] {
  let v = value < 0 ? 0 : Math.floor(value);
  const out = [v & 0x7f];
  v = Math.floor(v / 128);
  while (v > 0) {
    out.unshift((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  return out;
}

const u16 = (n: number): number[] => [(n >> 8) & 0xff, n & 0xff];
const u32 = (n: number): number[] => [
  (n >>> 24) & 0xff,
  (n >>> 16) & 0xff,
  (n >>> 8) & 0xff,
  n & 0xff,
];
const ascii = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0) & 0xff);

/** An event tagged with its absolute tick and a tie-break order for stable sorting. */
interface RawEvent {
  tick: number;
  order: number; // lower sorts first at equal tick
  data: number[];
}

function chunk(name: string, body: number[]): number[] {
  return [...ascii(name), ...u32(body.length), ...body];
}

function metaTrackName(name: string): number[] {
  const bytes = ascii(name);
  return [0xff, 0x03, ...vlq(bytes.length), ...bytes];
}

const END_OF_TRACK = [0xff, 0x2f, 0x00];

/** Build one MTrk chunk from absolute-tick events; appends End Of Track. */
function buildTrackChunk(events: RawEvent[]): number[] {
  const sorted = [...events].sort((a, b) => a.tick - b.tick || a.order - b.order);
  const body: number[] = [];
  let prevTick = 0;
  for (const ev of sorted) {
    body.push(...vlq(ev.tick - prevTick), ...ev.data);
    prevTick = ev.tick;
  }
  body.push(...vlq(0), ...END_OF_TRACK);
  return chunk('MTrk', body);
}

/** Track 0: tempo + name only. */
function buildConductorChunk(bpm: number): number[] {
  const mpq = Math.round(60000000 / bpm); // microseconds per quarter note
  const events: RawEvent[] = [
    { tick: 0, order: 0, data: metaTrackName('Tempo') },
    { tick: 0, order: 1, data: [0xff, 0x51, 0x03, (mpq >> 16) & 0xff, (mpq >> 8) & 0xff, mpq & 0xff] },
  ];
  return buildTrackChunk(events);
}

function buildNoteTrackChunk(track: MidiTrackData): number[] {
  const events: RawEvent[] = [
    { tick: 0, order: -1, data: metaTrackName(track.name) },
  ];
  for (const n of track.notes) {
    // At equal tick: name (-1) < note-off (0) < note-on (1), avoiding clipped retriggers.
    events.push({ tick: n.startTick, order: 1, data: [0x90 | n.channel, n.note, n.velocity] });
    events.push({ tick: n.startTick + n.durationTicks, order: 0, data: [0x80 | n.channel, n.note, 0] });
  }
  return buildTrackChunk(events);
}

/**
 * Serialize a MidiProject to a Standard MIDI File (Format 1) byte stream.
 * Deterministic: identical projects yield byte-identical output. Running status
 * is intentionally NOT used — every event carries its status byte, which is the
 * most compatible (and most debuggable) encoding.
 */
export function serializeMidi(project: MidiProject): Uint8Array {
  const ntrks = project.tracks.length + 1; // + conductor track 0
  const header = chunk('MThd', [
    ...u16(1), // format 1
    ...u16(ntrks),
    ...u16(project.ticksPerQuarter),
  ]);

  const bytes: number[] = [...header, ...buildConductorChunk(project.bpm)];
  for (const t of project.tracks) bytes.push(...buildNoteTrackChunk(t));
  return Uint8Array.from(bytes);
}
