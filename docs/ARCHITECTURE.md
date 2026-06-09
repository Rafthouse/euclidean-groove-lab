# Architecture & Roadmap

This document is a **contract**. It outlives any single session or contributor.
Read it before adding features; if a change violates it, change the document
deliberately — don't quietly work around it.

## Release status — TEST RELEASE / FEATURE FREEZE (2026-06-09)

The current version (commit `a914c87`) is a **test release** for live use and
feedback gathering. Active feature development is **paused** to stabilize.

**Frozen — do NOT start without an explicit new decision from the user:**

- Harmonic Layer; Variant C / Pitch Inspector
- Any new large feature
- Changes to the Pitch Layer data model
- Changes to the MIDI export architecture
- Speculative "just in case" refactoring

**Allowed during the freeze:**

1. Critical bug fixes
2. Regressions
3. Performance problems
4. Browser-compatibility problems
5. Small UX fixes that block real use

Any new large feature is first a DESIGN doc or a `docs/BACKLOG.md` entry — never
straight to code. Goal: stabilize this version before the next development phase.

## Core Product Thesis

**Euclidean Groove Lab is not a sequencer.** It is an educational laboratory for
studying how groove *emerges* from relationships between rhythmic structures.

Two rules follow, and must hold for the life of the project:

1. **The application must never model groove as a primitive.** Groove is always
   an emergent result of transformations — never a stored field, never a single
   number handed down by the engine.
2. **Euclidean geometry is one source of rhythm, not the centre.** The Euclidean
   distribution is the first of several strategies; the architecture stays open
   to clave, random, manual, and non-Euclidean traditions.

## The pipeline (the contract)

Everything in the app is a stage of one pure pipeline:

```
Pulse → Distribution → Rotation → Accent → Phase → Microtiming → Groove
```

- Each stage is a **pure** transform — no Tone.js, no React, no DOM.
- New behaviour is added as a **stage of this pipeline**, never bolted directly
  onto the UI or the audio layer. If you find yourself computing rhythm inside a
  React component or an audio callback — stop, it belongs in the engine.
- "Groove Evolution" (a planned feature) is just rendering the intermediate
  stages in order. Keeping the pipeline pure is what makes that nearly free.

## Naming rule

Name entities after the **pedagogy**, not the technique. Shared abstractions
must not be named `euclideanX`. The Euclidean algorithm lives in exactly one
place (`src/engine/euclidean.ts`, `euclid()`) as the first **Distribution**
strategy. Future strategies plug into the same pipeline with no rename.

## Measuring groove: axes, not a score

Never present groove as a single magic number:

```
✗   Groove Score = 73%
```

It looks scientific and almost always lies — an algorithmic oracle the student
must take on faith. Instead expose the **independent axes**:

```
✓   Density   Symmetry   Syncopation   Predictability
```

so the student sees *why* a pattern behaves as it does. Objective facts live in
`metrics.ts` (literature-grounded); any interpretive composite lives in
`perception.ts` and is always labelled a teaching model, never truth.

## Data model

```ts
type Pattern = boolean[];               // engine primitive

interface TrackPattern {                // per-track carrier; grows over time
  pulses: boolean[];
  accents?: number[];
  velocities?: number[];
  microtiming?: number[];
}

// Voice slot is fixed from Commit 1; each slot now has its own synthesized
// instrument (Commit 2): kick (membrane), snare (noise-filtered),
// hat (short noise), bass (triangle-wave synth).
type VoiceId = 'kick' | 'snare' | 'hat' | 'bass';

interface Track {                       // config / identity
  id: string;
  name: string;
  color: string;

  steps: number;
  hits: number;
  rotation: number;

  mute: boolean;
  solo: boolean;                        // if ANY track has solo=true,
                                        // only solo tracks sound (mute ignored within the solo set)
  voiceId: VoiceId;

  pitches?: PitchSequence;              // optional pitch layer; absent => drum-style.
                                        // Orthogonal to rhythm, onset-indexed, independent length.
                                        // Full model: docs/PITCH-DATA-MODEL-RECONCILIATION.md
}

interface Preset {                      // multi-track snapshot
  name: string;
  tracks: Track[];                      // 1..4 tracks: "Tresillo" = 1, "Bossa" = 4
  tradition?: string;                   // pedagogical note for World Rhythm Explorer
}

// trackPattern(track): TrackPattern
//   = { pulses: rotate(euclid(track.hits, track.steps), track.rotation) }
```

Engine functions operate on `boolean[]`; `TrackPattern` is the richer carrier
that accents / velocity / microtiming attach to later. A `Preset` is a
multi-track snapshot, never a single rhythm config — that decision is locked
because Bossa / Techno / Reggae are kits, not single patterns; folding them
into a single-rhythm model would force a rewrite in Commit 3.

### Pitch layer (orthogonal to rhythm)

The pitch layer is a **second independent cycle** that crosses the rhythm
pipeline's output — it is *not* a pipeline stage. It is onset-indexed (onset N
reads slot `N % slots.length`), so its length is independent of the rhythm;
when the two lengths differ, the cycles drift (isorhythm: rhythm = *talea*,
pitch = *color*). Drums omit it entirely. The model is reconciled and locked in
`docs/PITCH-DATA-MODEL-RECONCILIATION.md`; the canonical types:

```ts
type MidiNote = number;                 // 0–127, C4=60, E2=40; canonical for storage + export

type PitchSpec =                        // how ONE note is named
  | { kind: 'absolute'; midi: MidiNote }
  | { kind: 'degree'; degree: number; octaveOffset?: number };  // inert until Harmonic Layer

interface PitchEvent {                  // one sounded pitch at one onset
  pitch: PitchSpec;
  velocity?: number;                    // onset dynamics; precedence:
                                        //   PitchEvent.velocity > TrackPattern.velocities[step] > default
  durationSteps?: number;               // note length in 16th-steps (default 1); MIDI NoteOff
}

type PitchSlot = PitchEvent | null;     // null = sounded onset, no pitch (ghost / rest)

interface PitchSequence {               // onset-indexed cycle; length independent of rhythm
  id: string;
  name?: string;
  slots: PitchSlot[];
}
```

Three distinct concepts, never collapsed into one union: **Track presence**
(`pitches?` absent = none), **sequence content** (`PitchSequence.slots`), and
**per-note spec** (`PitchSpec`). The UI labels `none / fixed / sequence / scale`
are *derived* from the data, never stored. Harmony (`HarmonicContext` with global
`root` + `scale` + optional `chord`) is a separate global layer the `degree`
specs resolve against — built later with the Variant C inspector.

## Current state

- **Commit 1 (done).** Multi-track engine with `Track`, `TrackPattern`,
  `trackPattern()`, mute/solo semantics, 2×2 grid UI. Four voice slots
  defined (`VoiceId`), all initially mapped to the same kick synth.
- **Commit 2 (done).** Real voices: sample-based drum kits (CR-78 / Kit-8 /
  KPR-77, live-swappable) + sawtooth pick-bass synth. Engine-driven: `audio.ts`
  reads `currentTracks` by reference and computes `trackPattern()` each tick.
  Transport, BPM, swing (8th-note shuffle), mute/solo live audibly.
- **Commit 3 (done).** Pitch Layer (Variant B): `pitches?: PitchSequence` on
  Track — onset-indexed, length-independent of rhythm (isorhythm). Pure
  `engine/pitch.ts` (`resolveOnset`, `onsetIndexAt`, `resolvePitchSpec`, note
  parser/formatter). `absolute` path live; `degree`/`HarmonicContext` declared
  but inert. Per-track text-input lane + bar-contour visualization. Velocity
  precedence: `PitchEvent.velocity` > `TrackPattern.velocities[step]` > default.
  The pitch layer is offered ONLY for pitched voices (`isPitchedVoice`, today
  just bass); drum voices stay purely rhythmic and never call `resolveOnset`,
  so a sequence's rests can't become an accidental gate on a drum.
- **MIDI export (done).** Pure `engine/midi.ts`: `renderMidi(tracks, bars, bpm)`
  → `MidiProject`, then `serializeMidi(project)` → `Uint8Array` (Standard MIDI
  File, Format 1). Track 0 = tempo/meta conductor; one MTrk per Groove Lab track;
  drums → GM channel 10, pitched → melodic channels; mirrors the audio scheduler
  via `resolveOnset`. Deterministic, no external deps, no DOM (download lives in
  `src/download.ts`). "⤓ MIDI" button in the transport exports 4 bars.
- **Test-release UX additions** (user-directed, within the freeze): per-track
  **volume mixer** (`Track.volume`, applied via the existing `volume.value`);
  **responsive grid** (1 / 2 / 4 columns at 768 / 1200px); **manual mute
  overlay** (`Track.manualMute?: boolean[]`, step-indexed). Manual mute is a
  post-processing layer: `isStepMuted()` suppresses output in the audio
  scheduler and MIDI export, but never touches the Euclidean generator,
  rotation, density, or pitch onset-indexing — the generated pattern stays
  authoritative; click a ring onset to mute/restore it.
- **Themes** (CSS variables only): Dark Neon (default) + Vintage Paper. A
  `data-theme` on `<html>` swaps the variable set; persisted in localStorage,
  applied pre-paint in `main.tsx` (no flash). Track colours are sourced from
  CSS per voice (`.track-card[data-voice]`), so they re-skin with the theme;
  same DOM, same components, dark visually unchanged.
- **Metrics already shipped:** `density`, `syncopation` (LHL), `balance`
  (Toussaint), `isMaximallyEven`, `metricWeights`, `interOnsetIntervals`.

## Roadmap

### Pitch UI Design (done — design docs only)
- `docs/DESIGN-PITCH-UI.md` — three layout variants (A/B/C), pros/cons.
- **Decided:** Variant B (per-track Pitch Lane) is the primary Pitch Layer UI;
  Variant C (centralized Inspector) is deferred to the Harmonic Layer as a
  separate inspector, not a replacement for B; Variant A dropped.
- `docs/PITCH-DATA-MODEL-RECONCILIATION.md` — single locked data model
  (reconciles this contract, the UI doc, and the approved model).

### Commit 3 (done) — `feat: Pitch Layer (Variant B)`
- `pitches?: PitchSequence` on Track (onset-indexed, length-independent of rhythm).
- `absolute` path only: per-track **text-input** lane + bar-contour viz (drag
  editing deferred to a later commit). Storage is `MidiNote`.
- No pitch layer on drum tracks; default Bass has no pitch sequence (intrinsic E2 is a
  voice property, not the model). User adds a sequence explicitly.
- `degree` / `HarmonicContext` / `ChordProgression` types declared but inert.

### MIDI export (done) — `feat: MIDI export`
- `renderMidi()` + `serializeMidi()` in `engine/midi.ts`; Format 1, tempo
  conductor + per-track MTrk, GM drums, deterministic, unit-tested by bytes.
- Export length is a fixed 4 bars (`EXPORT_BARS`); a chosen/loop-aware length
  is a later refinement.

### Next: drag editing for the pitch lane
- Draggable contour bars, on top of the now-stable text-driven Pitch Layer.

### Later — `feat: Harmonic Layer (Variant C)`
- Global `HarmonicContext` (root + scale + optional chord); `degree` resolution goes live.
- `ChordProgression` as a bar-indexed cycle (up to 16-bar phrases); Variant C inspector.
- Variant B lane becomes a consumer: change a chord → degree specs re-resolve → bars move.

### Commit 4 — `feat: presets`
- Preset model = `Track[]` (multi-track snapshot), not a single-rhythm config.
- Single-track presets: Tresillo (E(3,8)), Son Clave (E(5,16) at a specific rotation).
- Full-kit presets: Bossa, Techno, Reggae One Drop.
- (Dub dropped as a preset — it's a production aesthetic, not a defined groove.
  Replace with Reggae One Drop which has a crisp, teachable kit.)

### Commit 5 — `feat: pedagogy (compare + microscope)`
- Compare Two Grooves: two patterns side by side, diff their metric axes,
  A/B audition. Nearly free given the pure pipeline.
- Groove Microscope: LHL syncopation visualised over a **fixed** meter while
  the pattern rotates over it. Anchor / tension / release coloured per onset.
- Metric explanations as hover tooltips on each axis (one sentence each),
  not a modal — the explanation lives where the student is already looking.

### Later — `feat: world rhythm explorer`
- Toussaint presets, Clave family, West African timelines, Balkan meters,
  Arabic iqaat. Builds on the locked Preset = Track[] model.

Later, only once the core is solid: probability, accents, swing,
polyrhythm mode, MIDI export, MIDI clock.

## Guiding constraint

> If the core lies by one step, the Microscope will lie beautifully but
> confidently — the most dangerous kind of bug. Keep the engine pure and
> test-covered; UI and audio are downstream consumers only.