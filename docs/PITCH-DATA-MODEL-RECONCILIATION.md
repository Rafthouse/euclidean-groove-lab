# Pitch Data Model — Reconciliation

> **Status:** Design reconciliation (no code).
> **Purpose:** Resolve the divergence between `docs/ARCHITECTURE.md`, `docs/DESIGN-PITCH-UI.md`,
> and the model approved in conversation, into ONE final data model before the
> `feat: Pitch Layer (Variant B)` commit.
> **Decisions locked:** Variant B = primary Pitch Layer UI; Variant C = future Harmonic Layer
> Inspector; pitch is orthogonal to rhythm, onset-indexed, universal, optional, MIDI-first-class.

## Three sources, three models

| Source | What it defines | Form |
|---|---|---|
| `ARCHITECTURE.md` (roadmap prose, lines 135–139) | "PitchSpec union on Track (pitch sequence or scale-based)", "per-onset", "no pitch on drums", "default Bass has no pitch sequence" | **prose only — no concrete types** |
| `DESIGN-PITCH-UI.md` (lines 9–19) | `PitchSpec` with `mode: none\|fixed\|sequence\|scale`, `note: string`, `notes: string[]`, per-track `root`+`scale` | **concrete types** |
| Approved in conversation | `PitchSequence` / `PitchSlot` / `PitchEvent` / `PitchSpec(kind: absolute\|degree)`, `MidiNote`, global `HarmonicContext` | **concrete types** |

The core problem: **`DESIGN-PITCH-UI.md` collapses three distinct concepts into one union.**
It makes a single `PitchSpec` carry (a) the track-level *mode*, (b) the per-onset *content*,
and (c) the per-note *specification*. The approved model keeps them as three separate layers.
Everything below follows from untangling that.

---

## Discrepancies

### D1 — One union vs. layered model (the root conflict)

- **ARCHITECTURE:** "PitchSpec union on Track (pitch sequence or scale-based)." Vague; implies
  the Track-level field is itself the union.
- **DESIGN-PITCH-UI:** `Track.pitch?: PitchSpec`, where `PitchSpec = none | fixed | sequence | scale`.
  The mode and the data are the same object.
- **Recommendation:** **Three layers, not one union.**
  1. *Track presence* — does the track have a pitch layer at all (`Track.pitches?`).
  2. *Sequence content* — the onset-indexed list (`PitchSequence.slots`).
  3. *Per-note spec* — how one pitch is named (`PitchSpec = absolute | degree`).
  The four "modes" (`none/fixed/sequence/scale`) become a **derived UI view-state**, never stored.

### D2 — Discriminant name: `kind` vs `mode`

- **ARCHITECTURE:** unspecified.
- **DESIGN-PITCH-UI:** `mode: 'none' | 'fixed' | 'sequence' | 'scale'`.
- **Recommendation:** Use **`kind`** for the per-note `PitchSpec` (`'absolute' | 'degree'`).
  Drop `mode` from the data model entirely — derive it for the UI (see D6). This removes the
  clash: `kind` describes a note, `mode` describes a view.

### D3 — Note representation: `string` vs `MidiNote`

- **ARCHITECTURE:** unspecified (prose says "maps notes → MIDI note numbers" for export).
- **DESIGN-PITCH-UI:** `note: string` / `notes: string[]` (e.g. `'E2'`).
- **Recommendation:** **Store `MidiNote` (number).** Note names are a *display/input* concern.
  Provide `noteNameToMidi('E2') → 40` and `midiToNoteName(40) → 'E2'` helpers for the UI.
  Rationale: MIDI export is first-class — storing numbers makes export a no-op and removes a
  parsing/round-trip failure surface. (`E2 = 40`, `C4 = 60`.)

### D4 — Rests / silent onsets

- **ARCHITECTURE:** not addressed.
- **DESIGN-PITCH-UI:** no per-onset rest; `'none'` mode silences the *whole* track's pitch.
- **Recommendation:** Keep **`PitchSlot = PitchEvent | null`**, where `null` = a sounded
  rhythmic onset with **no pitch** (ghost note / MIDI rest). This is distinct from
  `Track.pitches === undefined` (no pitch layer at all). Two different silences:
  - `Track.pitches === undefined` → drum-style: the voice fires its intrinsic sound on every onset.
  - `slot === null` → pitched track, but this particular onset is a rest.

### D5 — Per-note velocity & duration

- **ARCHITECTURE:** `TrackPattern.velocities?: number[]` exists and is **step-indexed**
  (already shipped; `audio.ts` reads `velocities[step % steps]`).
- **DESIGN-PITCH-UI:** bare note strings — no per-note velocity or duration.
- **Approved:** `PitchEvent.velocity?` + `durationSteps?` — **onset-indexed**.
- **Conflict:** velocity would live in two places with two different indexings.
- **Decision (locked):** **Both velocities coexist, resolved by an explicit precedence rule.**
  - `PitchEvent.velocity` — onset-indexed note dynamics (pitch domain). Optional.
  - `TrackPattern.velocities` — step-indexed accent (rhythm domain, Accent pipeline stage; applies
    to drums too). Already shipped.
  - **Precedence at audio/export time, per onset:**
    `PitchEvent.velocity` **>** `TrackPattern.velocities[step]` **>** default velocity.
    The first defined value wins; nothing is summed, so there is no double-counting.
  - `PitchEvent.durationSteps?` stays too (note length / MIDI NoteOff / bass sustain).

### D6 — `'fixed'` and `'none'` as modes

- **DESIGN-PITCH-UI:** `'fixed'` (one held note) and `'none'` are first-class union members.
- **Approved:** neither is a stored mode.
- **Recommendation:** Express both through existing structure, no special cases:
  - `'none'` = `Track.pitches === undefined`.
  - `'fixed'` = a `PitchSequence` with a **single absolute slot** (`slots.length === 1`); length-1
    cycles, so the same note plays on every onset.
  - `'sequence'` = length-N absolute slots.
  - `'scale'` = slots using `kind: 'degree'`.
  The UI derives the label; the model stays minimal and cannot reach invalid states (e.g.
  `mode === 'fixed'` with five notes).

### D7 — Where scale/key lives: per-track vs global

- **ARCHITECTURE:** "scale-based" (unspecified location).
- **DESIGN-PITCH-UI:** `root` + `scale` stored **on each track's** pitch (`{ mode:'scale'; root; scale; pattern }`).
- **Approved:** `root` + `scale` live in a **global `HarmonicContext`**; per-note specs only carry a `degree`.
- **Recommendation:** **Global `HarmonicContext`, not per-track.** A chord progression must drive
  all tracks coherently; per-track root+scale would fight a global progression and make
  "transpose the whole groove" or "change the IV chord" impossible without editing every track.
  Per-note `PitchSpec` carries only `degree` (+ optional `octaveOffset`); it resolves against the
  context. This is the single most important fork for the future Harmonic Layer.

### D8 — Default Bass pitch & register

- **ARCHITECTURE:** "Default Bass has no pitch sequence; user adds it explicitly."
- **DESIGN-PITCH-UI:** "Bass defaults to `'fixed'` = `'E1'`."
- **Reality:** `audio.ts` plays bass at a fixed `E2` (raised from E1 in commit `f937b8d`).
- **Recommendation:** **Default Bass `pitches === undefined`** (matches the approved decision).
  The audible note when no pitch layer is present is the **voice's intrinsic fallback** (`E2`),
  a property of the audio voice, **not** of the pitch model. Reject both `'fixed'` mode and the
  `E1` value from DESIGN-PITCH-UI.

### D9 — Track field name: `pitch` vs `pitches`

- **DESIGN-PITCH-UI:** `Track.pitch?`.
- **Approved:** `Track.pitches?`.
- **Recommendation:** **`pitches?: PitchSequence`** — plural signals it holds a sequence of slots
  and reads distinctly from the per-note `PitchSpec`.

### D10 — `ScaleType` home

- Both docs reference `ScaleType` but neither defines it in a shared place.
- **Recommendation:** Define it once, in the harmony module, used only by degree resolution
  (inert until the Harmonic Layer). Listed in the final model below.

---

## Final data model

> Layering, top to bottom: **Track** (presence) → **PitchSequence** (onset cycle) →
> **PitchSlot** (rest or event) → **PitchEvent** (one note) → **PitchSpec** (how the note is named).
> Harmony (`HarmonicContext`, `ChordProgression`) is a *separate* global layer that `degree`
> specs resolve against — built later, with Variant C.

### Pitch primitives

```ts
/** MIDI note number, 0–127. C4 = 60, E2 = 40. Canonical for storage + export. */
export type MidiNote = number;

/**
 * How a single pitch is named.
 *  - 'absolute' : a concrete MIDI note (used now, Variant B).
 *  - 'degree'   : a scale degree, resolved against a HarmonicContext (inert until
 *                 the Harmonic Layer / Variant C; the branch exists now so adding
 *                 it later needs no migration).
 */
export type PitchSpec =
  | { kind: 'absolute'; midi: MidiNote }
  | { kind: 'degree'; degree: number; octaveOffset?: number };

/**
 * One sounded pitch at one onset.
 *  - `velocity`      : onset-indexed note dynamics (0–127). Optional. When set it
 *                      OVERRIDES the step accent for this onset (see D5 precedence).
 *  - `durationSteps` : note length in 16th-steps (default 1) — used for MIDI
 *                      NoteOff and bass sustain.
 * Velocity precedence (per onset):
 *   PitchEvent.velocity > TrackPattern.velocities[step] > default.
 */
export interface PitchEvent {
  pitch: PitchSpec;
  velocity?: number;
  durationSteps?: number;
}

/** One slot of a pitch cycle. `null` = sounded onset with no pitch (ghost / rest). */
export type PitchSlot = PitchEvent | null;

/**
 * A cyclic sequence of pitches, onset-indexed and INDEPENDENT in length from the
 * rhythm. Onset N reads `slots[N % slots.length]`. When length ≠ onset count the
 * two cycles drift — isorhythm (talea = rhythm, color = this).
 *
 *  - undefined on a Track  => no pitch layer (drum-style).
 *  - slots.length === 1     => "fixed" (same note every onset).
 *  - slots.length === N     => a melodic sequence.
 *  - all slots kind:'degree' => "scale" (resolved via HarmonicContext).
 */
export interface PitchSequence {
  id: string;
  name?: string;
  slots: PitchSlot[];
}
```

### Track integration

```ts
export interface Track {
  // ...existing fields unchanged...
  pitches?: PitchSequence;   // absent => drum-style; present => pitched
}
```

`trackPattern(track)` is unchanged — pitch does **not** belong to the rhythm carrier. Resolution
is a separate pure function:

```ts
/** Global onset index for a track at a given global step (pure, no state). */
export function onsetIndexAt(track: Track, pulses: boolean[], globalStep: number): number;

/** What sounds at this step. null => no onset here OR no pitch layer (drum path). */
export interface ResolvedOnset {
  step: number;
  midi?: MidiNote;        // undefined => rest slot (sounded onset, no pitch)
  velocity: number;       // resolved per D5 precedence (event > step accent > default)
  durationSteps: number;
}
export function resolveOnset(
  track: Track,
  pulses: boolean[],
  globalStep: number,
  ctx?: HarmonicContext,   // optional; only used by degree specs
): ResolvedOnset | null;
```

### UI view-state (derived, never stored)

```ts
export type PitchMode = 'none' | 'fixed' | 'sequence' | 'scale';

export function pitchMode(seq?: PitchSequence): PitchMode {
  if (!seq) return 'none';
  if (seq.slots.every((s) => s && s.pitch.kind === 'degree')) return 'scale';
  if (seq.slots.length === 1) return 'fixed';
  return 'sequence';
}
```

This is the bridge to `DESIGN-PITCH-UI.md`: its four `mode` values survive as a **rendering
label**, computed from the data, not a stored field.

### Degree-based notes (Harmonic Layer — defined now, inert now)

```ts
export type ScaleType =
  | 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian'
  | 'harmonic-minor' | 'melodic-minor' | 'pentatonic-major' | 'pentatonic-minor' | 'chromatic';

export interface ChordSymbol {
  degree: number;                       // scale degree the chord is rooted on (1-based)
  quality: 'maj' | 'min' | 'dom7' | 'maj7' | 'min7' | 'dim' | 'aug';
}

/** Global harmonic context a `degree` PitchSpec resolves against. */
export interface HarmonicContext {
  root: MidiNote;                       // tonic, e.g. 48 = C3
  scale: ScaleType;
  chord?: ChordSymbol;                  // optional active chord (degree may target chord tones)
}

/** absolute → midi directly; degree → resolved via ctx (root + scale, optional chord). */
export function resolvePitchSpec(spec: PitchSpec, ctx?: HarmonicContext): MidiNote;
```

`degree` is 1-based within the scale; degrees beyond the scale length wrap and raise an octave,
with `octaveOffset` adding octaves on top. With no `ctx`, only `absolute` specs resolve; `degree`
specs are inert (no UI creates them until Variant C).

### Harmonic Layer / progression (Variant C — future, not built now)

```ts
/** A bar-indexed cycle of harmonic contexts — an independent layer, like pitch is to rhythm. */
export interface ChordProgression {
  id: string;
  name?: string;
  segments: HarmonicContext[];          // one context per segment
  stepsPerSegment: number;              // default 16 = one 4/4 bar; supports up to 16-bar phrases
}
```

The progression is the natural inhabitant of the **Variant C Inspector**. The Variant B lane
becomes its consumer: change a chord in the inspector → degree specs re-resolve → lane bars move.

### MIDI export (first-class — model is already export-shaped)

Because pitches are stored as `MidiNote`, export is a deterministic pass with no parsing:

```ts
export interface MidiNoteEvent {
  tick: number;        // in 16th-note ticks from bar 0
  channel: number;     // pitched track => own channel; drum => 9 (GM channel 10)
  note: number;        // MidiNote
  velocity: number;    // PitchEvent.velocity > TrackPattern.velocities[step] > default
  duration: number;    // durationSteps, in ticks
}
export interface MidiTrack { name: string; channel: number; events: MidiNoteEvent[]; }
export interface MidiFile  { ticksPerQuarter: number; bpm: number; tracks: MidiTrack[]; }

/** General MIDI percussion map for drum tracks (no pitch layer). */
export const GM_DRUM_MAP: Record<VoiceId, number> = {
  kick: 36, snare: 38, hat: 42, bass: 36,   // bass overridden when it has a pitch layer
};

export function renderMidi(tracks: Track[], bars: number, bpm: number,
                           ctx?: HarmonicContext): MidiFile;
```

- Pitched track: `note = resolveOnset(...).midi`.
- Drum track (`pitches === undefined`): `note = GM_DRUM_MAP[voiceId]`, channel 9.
- Rest slot (`midi === undefined`): emit nothing.
- Binary `.mid` encoding is a downstream serializer of `MidiFile`, unaffected by this model.

---

## What changes in the existing docs (on model approval)

1. **`ARCHITECTURE.md` "Data model"** — add the pitch primitives above and `Track.pitches?`.
   Replace the roadmap prose "PitchSpec union on Track (pitch sequence or scale-based)" with a
   pointer to this reconciled model (PitchSpec is per-note; the Track carries a `PitchSequence`).
2. **`DESIGN-PITCH-UI.md` "Data model (approved)"** — replace lines 9–19 with the final model,
   and reframe its `none/fixed/sequence/scale` as the derived `pitchMode()` view-state (D6).
   Change the Bass default note reference `E1` → no pitch layer; intrinsic voice note `E2` (D8).

## Summary of rulings

| # | Ruling |
|---|---|
| D1 | Three layers (Track presence / sequence / per-note spec), not one union |
| D2 | `kind` for per-note spec; `mode` is derived UI state, not stored |
| D3 | Store `MidiNote` (number); note names are display-only |
| D4 | `PitchSlot = PitchEvent \| null`; `null` rest ≠ absent layer |
| D5 | Both velocities coexist; precedence `PitchEvent.velocity` > `TrackPattern.velocities[step]` > default; `PitchEvent` keeps `velocity?` + `durationSteps?` |
| D6 | `none`/`fixed`/`sequence`/`scale` are derived, not stored |
| D7 | Global `HarmonicContext`, not per-track root+scale |
| D8 | Default Bass = no pitch layer; `E2` is the voice's intrinsic fallback |
| D9 | Track field is `pitches?: PitchSequence` |
| D10 | `ScaleType` defined once in the harmony module, inert until Variant C |

**On approval of this model**, the next commit is `feat: Pitch Layer (Variant B)`, implementing
only the `absolute` path (lane UI, onset-indexed sequence, MIDI-ready storage). The `degree` /
`HarmonicContext` / `ChordProgression` types are declared but inert until the Harmonic Layer.
