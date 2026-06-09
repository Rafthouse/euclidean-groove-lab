# Pitch UI — Design Variants

> **Status:** Design exploration (no code).
> **Context:** Pitch layer is orthogonal to rhythm, per-onset (not per-step), universal across Track types, optional for drums, and first-class for MIDI export.

## Data model (locked)

> **Superseded.** The earlier `mode`-union sketch is replaced by the reconciled
> model in `docs/PITCH-DATA-MODEL-RECONCILIATION.md`. The canonical types:

```ts
type MidiNote = number;                 // 0–127, C4=60, E2=40; storage + export

type PitchSpec =                        // how ONE note is named
  | { kind: 'absolute'; midi: MidiNote }
  | { kind: 'degree'; degree: number; octaveOffset?: number };  // inert until Harmonic Layer

interface PitchEvent { pitch: PitchSpec; velocity?: number; durationSteps?: number; }
type PitchSlot = PitchEvent | null;     // null = sounded onset, no pitch (ghost / rest)
interface PitchSequence { id: string; name?: string; slots: PitchSlot[]; }  // onset-indexed

// Track.pitches?: PitchSequence        // absent => drum-style (no pitch layer)
```

Three layers, never one union: **Track presence** (`pitches?`), **sequence content**
(`slots`), **per-note spec** (`PitchSpec`). The mode words used in the mockups below —
`none / fixed / sequence / scale` — are a **derived UI view-state**, not stored fields:

```ts
type PitchMode = 'none' | 'fixed' | 'sequence' | 'scale';
function pitchMode(seq?: PitchSequence): PitchMode {
  if (!seq) return 'none';
  if (seq.slots.every((s) => s && s.pitch.kind === 'degree')) return 'scale';
  if (seq.slots.length === 1) return 'fixed';
  return 'sequence';
}
```

Drum tracks have `pitches === undefined`. **Default Bass also has no pitch layer**
(`pitches === undefined`); the audible `E2` is the bass voice's intrinsic fallback note,
a property of the audio layer, not of this model. The user adds a sequence explicitly.
Note names (`E2`) shown in the editors are display only — storage is always `MidiNote`.
MIDI export reads `MidiNote` directly (no parsing); `degree` specs resolve via the global
`HarmonicContext` once the Harmonic Layer lands.

---

## Variant A — Pitch Drawer (inline within card)

### Layout

Each TrackCard gains a **Pitch toggle button** in the track head row (next to M/S).
When activated, an inline section slides open between the sequencer ring and the
slider controls:

```
┌──────────────────────────────┐
│  BASS                 M S [⏏] │  ← new Pitch toggle
│       (ring sequencer)        │
│ ┌──────────────────────────┐ │
│ │ ○ Fixed  ○ Sequence  ● Scale │  ← mode selector
│ │ Root: [C↓] Scale: [Minor↓]│ │
│ │ ░░▓▓▓░▓▓░░▓▓░▓▓▓░▓▓░░  │ │  ← onset-indexed row
│ │ ① ② ③   ④ ⑤   ⑥ ⑦      │ │  ← onset number labels
│ └──────────────────────────┘ │
│  Steps 16   Hits 3   Rot 0   │
│  [=========] [=] [=]         │
└──────────────────────────────┘
```

### Pitch-on-ring visual

- Onset dots on the ring are **colored by pitch class** (rainbow: C=red, D=orange,
  E=yellow, F=green, G=blue, A=indigo, B=violet)
- **Size encodes octave**: C2 smaller than C3 larger than C1
- Tooltip on hover: note name + octave
- The ring's color-coding works for all four modes (even `'none'` = all dots same
  track color, no size variation)

### Sequence mode editor

A linear array of dropdowns or clickable note labels, one per onset position.
Each position shows a note name (e.g. `E2`) and toggles through circle-of-fifths
on click, or opens a miniature keyboard select on long-press.

### Scale mode editor

Root selector + scale type dropdown (Major, Minor, Dorian, Phrygian, etc.) +
a row of step-selector buttons showing scale degrees (Ⅰ Ⅱ Ⅲ Ⅳ Ⅴ Ⅵ Ⅶ) per onset.
User clicks a degree to assign it.

### Pros

- **Self-contained:** all pitch editing lives inside the card, no layout shift for other tracks
- **Low context switch:** user sees ring + pitch controls in one view
- **Natural fit for `'fixed'` mode:** single dropdown, minimal chrome
- **Works at mobile widths:** the drawer stacks vertically under the ring

### Cons

- **Card height grows significantly** for sequence mode (8+ onset tracks make a tall card)
- **No simultaneous comparison** of pitch across tracks without scrolling
- **Sequence editing is cramped** for long onset sequences (>12 notes)
- **The drawer competes with sliders for vertical space**

---

## Variant B — Pitch Lane (horizontal strip below the ring)

### Layout

Each TrackCard gets a dedicated horizontal lane below the sequencer ring.
The lane is always visible when pitch is enabled (controlled by the same toggle
in the track head). Height: ~48px for a single octave range.

```
┌──────────────────────────────┐
│  BASS                     M S │
│       (ring sequencer)        │
│ ════════════════════════════ │  ← pitch lane (always visible when on)
│  ▓▓      ▓▓▓▓    ▓▓    ▓▓    │  ← bars at onset positions only
│  E1 D2   E2 E3   F2    G2    │  ← note labels below bars
│ ○ Off  ● Seq  ○ Scale        │  ← compact mode selector (inline)
│ [Notes: E1 D2 E2 E3 F2 G2  …]│  ← editable text row for sequence mode
└──────────────────────────────┘
```

### Pitch visualization on the ring AND lane

- **Ring dots** are still colored by pitch class (as in Variant A)
- **Lane bars** show the pitch contour physically: bar height = MIDI note number
  relative to the track's range. This gives an instant visual of the melodic shape.
- Bars only appear at **onset positions** — rests are gaps. This respects the
  per-onset-indexed contract and visually reinforces that pitch doesn't add steps.

### Sequence mode

The lane bars are **draggable up/down** (within a 1–3 octave range shown as a
pale staff background). Adjacent bars reflow. Below the lane, a text field shows
the raw sequence `E1 D2 E2 E3 F2 G2` — editable inline for power users.

### Scale mode

The lane shows a snapped staff with scale degrees as horizontal tramlines.
Bars snap to the nearest scale degree. Controls: root, scale type, and a
per-onset degree selector (click bar → select Ⅰ–Ⅶ from a popup).

### Pros

- **Pitch contour is visible at a glance** — the lane shows melodic shape
  directly, which is the core pedagogical value
- **No card height explosion:** lane is a fixed ~48px, doesn't grow with onset count
- **Draggable bars** for sequence mode feel tactile and musical
- **Lane + ring = dual encoding** (ring = cyclic position, lane = linear pitch)

### Cons

- **Lane width is fixed** — long patterns (32 steps) make bars very narrow
- **Dragging requires pointer/fine motor control** — less accessible
- **Scale mode needs more height** (degree labels, snapped grid lines)
- **Layout tension** between "ring is the star" and "lane competes for attention"

---

## Variant C — Pitch Inspector (centralized side panel)

### Layout

The 2×2 grid stays clean: no pitch widgets inside cards at all. Instead:

1. **Ring dots change color by pitch class** (same as other variants) — this is
   the only pitch UI on the card in normal state
2. Selecting a track and clicking its **"Pitch" badge** (or a dedicated button)
   opens a side panel / modal overlay

```
┌─────────────────────────┬──────┐
│  KICK   SNARE           │ ║    │
│  (ring)  (ring)         │ ║ PITCH INSPECTOR │
│                         │ ║ ─────────────── │
│  BASS   HAT             │ ║ Bass - Sequence │
│  (ring)  (ring)         │ ║ ┌────────────┐  │
│                         │ ║ │C2 ●        │  │
│                         │ ║ │B1 ●        │  │
│                         │ ║ │G1 ● ● ●   │  │  ← piano-roll grid
│                         │ ║ │E1 ● ●     │  │     rows = pitch
│                         │ ║ │  ① ② ③ ④ │  │     cols = onset index
│                         │ ║ └────────────┘  │
│                         │ ║ Mode: [● Seq v] │
│                         │ ║ Root: [C  ]     │
│                         │ ║ Scale: [Maj ]   │
└─────────────────────────┴──────┘
```

### Piano-roll grid

- Columns = onset indices (1, 2, 3, … N)
- Rows = available pitches (shown as a vertical keyboard or note-name labels)
- Each onset column shows one active note (or blank for rest)
- Click a column to change its pitch: type note name, click keyboard, or drag vertically
- Scale mode: grid rows filter to only scale degrees; columns snap to degree selector

### Mode selector

- A dropdown in the inspector header: `None | Fixed | Sequence | Scale`
- Switching mode transforms the grid:
  - None: grid hidden
  - Fixed: single row showing the fixed note
  - Sequence: full grid
  - Scale: grid shows only scale degrees; degree selector per column

### Card badges

Instead of inline controls, each track card shows a compact pitch badge:
- No pitch: no badge (or dimmed "Pitch" text)
- Fixed: shows note name `E1`
- Sequence: shows count `4 notes`
- Scale: shows key `C Maj`

### Pros

- **Cleanest card layout** — no pitch chrome pollutes the rhythm-focused 2×2 grid
- **Piano-roll editor is powerful** — familiar to any DAW/MIDI user, scales to
  any number of onsets or octaves
- **Pitch across tracks is comparable** — open inspector, switch track, same
  position and scale
- **MIDI Export maps trivially** — the grid IS a MIDI clip editor; export is
  one transformation away
- **Inspector can grow** later to hold per-onset velocity, accent, microtiming

### Cons

- **Context switch** — editing pitch requires opening a separate panel, losing
  sight of the sequencer ring
- **Over-engineered for simple cases** — setting bass to a fixed E1 shouldn't
  need a modal
- **Tone-on-ring is the only real-time feedback** — user must close panel to see
  how pitch change looks on the ring
- **Side panel on mobile** — requires overlay or full-screen modal

---

## Comparison matrix

| Criterion | A – Drawer | B – Lane | C – Inspector |
|---|---|---|---|
| **Card stays compact** | ❌ (grows) | ⚠️ (+48px) | ✅ |
| **Pitch contour visible instantly** | ❌ (list only) | ✅ (bars) | ⚠️ (panel open) |
| **Editing >12 onsets** | ❌ cramped | ⚠️ narrow bars | ✅ full grid |
| **Low onset count (<6)** | ✅ | ✅ | ⚠️ overkill |
| **Scale mode clarity** | ✅ degree labels | ⚠️ snapped + popup | ✅ filtered grid |
| **`fixed` mode UX** | ✅ single dropdown | ⚠️ lane with one bar | ❌ modal for one note |
| **Mobile friendly** | ⚠️ (scroll) | ✅ (tap bars) | ❌ (panel) |
| **MIDI export mapping** | ✅ | ✅ | ✅ trivially |
| **Pedagogical value** | ⚠️ (read notes) | ✅ (see shape) | ⚠️ (DAW familiarity) |
| **Implementation cost** | medium | medium | high |

---

## Recommendation (decided)

**Locked:**

- **Variant B (Pitch Lane) = primary Pitch Layer UI.** It is the only variant that
  shows isorhythm drift across the 2×2 grid at a glance — the core pedagogical value —
  and the per-track onset lane is the most faithful view of the locked data model.
- **Variant C (Inspector) = future Harmonic Layer.** Deferred, and framed as a
  *separate inspector*, not a replacement for B. It is the natural home for the global
  `HarmonicContext` and `ChordProgression` (per-bar chords, up to 16-bar phrases).
  When it lands, the Variant B lane becomes its consumer: change a chord → degree specs
  re-resolve → lane bars move.
- **Variant A (Drawer) = dropped.** Inline drawer grows card height and cannot compare
  pitch across tracks.

This is not a hybrid "expand button" — B and C serve *different layers*: B edits
per-onset pitches, C edits the harmonic context those pitches resolve against.

Rationale and the full per-criterion comparison live with the decision record;
the data model is locked in `docs/PITCH-DATA-MODEL-RECONCILIATION.md`.