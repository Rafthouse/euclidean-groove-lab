# Architecture & Roadmap

This document is a **contract**. It outlives any single session or contributor.
Read it before adding features; if a change violates it, change the document
deliberately — don't quietly work around it.

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

// Voice slot is fixed from Commit 1 even though all four voices initially map
// to the same kick synth -- this makes Commit 2 a swap, not a rewrite.
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

## Current state (Commit 0 — done, deployed)

- Pure engine in `src/engine/`: `pulse`, `euclid` (true Bjorklund), `rotate`,
  `phase`, `metrics`. 48 vitest tests; `Sequencer.tsx` consumes the engine
  (single source of truth).
- **Not yet engine-driven:** `audio.ts` plays a hardcoded pattern — you *see*
  one thing and *hear* another until Commit 2.
- **Metrics already shipped:** `density`, `syncopation` (LHL), `balance`
  (Toussaint), `isMaximallyEven`, `metricWeights`, `interOnsetIntervals`. The
  "groove metrics foundation" mostly exists already; Commit 1.5 only adds
  symmetry.

## Roadmap

### Commit 1 — `feat: multi-track engine`
- `Track`, `TrackPattern`, `trackPattern()`, tests
- 4 independent tracks; defaults: Kick / Snare / Hat / Bass (voiceId set)
- mute + solo (semantics in Data model above)
- 2×2 grid of small rings — one ring per track, per-track controls panel,
  per-track playhead. (Concentric-rings view is a later optional mode;
  grid is the default because it stays readable when `steps` differs
  across tracks.)
- Audio: each track has its own voice slot from day one. All four slots
  currently invoke the kick synth — that's intentional, so Commit 2 swaps
  voices without re-plumbing the audio graph.

### Commit 1.5 — `feat: symmetry metrics`
- rotational symmetry
- mirror symmetry
- `perception.ts` scaffold

### Commit 2 — `feat: audio layer`
- kick / rimshot / shaker / bass (synthesized, not soundfonts)
- transport, BPM, swing, mute/solo

### Commit 3 — `feat: groove microscope`
- LHL syncopation visualization
- anchor detection
- tension map
- release map

### Commit 3 — `feat: presets`
- Preset model = `Track[]` (multi-track snapshot), not a single-rhythm config.
- Single-track presets: Tresillo (E(3,8)), Son Clave (E(5,16) at a specific rotation).
- Full-kit presets: Bossa, Techno, Reggae One Drop.
- (Dub dropped as a preset — it's a production aesthetic, not a defined groove.
  Replace with Reggae One Drop which has a crisp, teachable kit.)

### Commit 4 — `feat: pedagogy (compare + microscope)`
- Compare Two Grooves: two patterns side by side, diff their metric axes,
  A/B audition. Nearly free given the pure pipeline.
- Groove Microscope: LHL syncopation visualised over a **fixed** meter while
  the pattern rotates over it. Anchor / tension / release coloured per onset.
- Metric explanations as hover tooltips on each axis (one sentence each),
  not a modal — the explanation lives where the student is already looking.

### Later — `feat: world rhythm explorer`
- Toussaint presets, Clave family, West African timelines, Balkan meters,
  Arabic iqaat. Builds on the locked Preset = Track[] model.

Later, only once 4 tracks actually play: probability, accents, swing,
polyrhythm mode, MIDI export, MIDI clock.

## Guiding constraint

> If the core lies by one step, the Microscope will lie beautifully but
> confidently — the most dangerous kind of bug. Keep the engine pure and
> test-covered; UI and audio are downstream consumers only.
