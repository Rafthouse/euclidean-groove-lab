# Backlog — deferred work

> The project is in a **TEST RELEASE / FEATURE FREEZE** (see `ARCHITECTURE.md`).
> New large features land here (or as a DESIGN doc) **before** any code. During
> the freeze, only critical bugfixes, regressions, performance, browser
> compatibility, and small blocking-UX fixes are implemented.

## Deferred features (decided, not started)

- **Harmonic Layer (Variant C).** Global `HarmonicContext` (root / scale /
  optional chord); `degree` resolution goes live; `ChordProgression` as a
  bar-indexed cycle up to 16-bar phrases; centralized Pitch Inspector panel.
  Types are already declared inert in `engine/pitch.ts`.
- **Drag editing for the pitch lane.** Draggable contour bars on top of the
  stable text-input layer (`docs/DESIGN-PITCH-UI.md` Variant B).
- **Loop-aware MIDI export length.** Currently fixed `EXPORT_BARS = 4`; later,
  derive a clean loop length from the tracks (LCM of cycles).
- **Presets** (`Preset = Track[]`): Tresillo, Son Clave, Bossa, Techno,
  Reggae One Drop.
- **Pedagogy:** Compare Two Grooves; Groove Microscope; `perception.ts`;
  World Rhythm Explorer.

## Known limitations (acceptable for the test release)

- MIDI export is a fixed 4 bars; 4/4 assumed (16 steps/bar). Odd-length tracks
  drift against DAW bar lines — faithful to the app, but worth noting.
- CI GitHub Actions run on Node 20 — deprecation warning; bump by ~Sep 2026.

## Pain points & feedback (fill during live use)

> Capture real findings here while using the app as an instrument and testing
> MIDI in Ableton/Reaper. Keep them concrete: what blocked making music, what was
> confusing, what broke.

- _(none yet)_
