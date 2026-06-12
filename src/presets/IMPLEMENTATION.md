# Historical Rhythm Presets - Implementation Guide

## Overview
Цей файл містить 7 готових пресетів для Euclidean Groove Lab, адаптованих з історичних ритмів Тома Туссайнта.

## Usage

```typescript
import { rhythmPresets, getRhythmPreset } from './presets';

// Load preset by ID
const preset = getRhythmPreset('clave-son-kit');
if (preset) {
  setTracksState(preset.tracks);
}

// Or get all 5-star authentic presets
import { getPresetsByAuthenticity } from './presets';
const highAuthPresets = getPresetsByAuthenticity(5);
```

## Preset Structure

Кожен пресет - це `RhythmPreset[]`:

```typescript
interface RhythmPreset {
  id: string;           // шукальний ID
  name: string;         // читабельна назва
  description: string;  // короткий опис
  source_rhythm?: string;  // джерело (Toussaint)
  source_pattern?: number[]; // інтервали [3,3,4,2,4]
  authenticity?: number;   // 1-5 зірочок
  tracks: Track[];        // 4 треки (kick/snare/hat/bass)
}
```

## Available Presets

| ID | Name | Steps | Authenticity | Pattern | Use Case |
|----|------|-------|--------------|---------|----------|
| `shiko-kit` | Shiko Kit | 16 | ★★★★☆ | [4,2,4,2,4] | Afro-Cuban hybrid |
| `clave-son-kit` | Clave Son Kit | 16 | ★★★★★ | [3,3,4,2,4] | Latin house foundation |
| `tresillo-kit` | Tresillo Kit | 8 | ★★★★★ | [3,3,2] | Reggaeton core |
| `bossa-nova-kit` | Bossa Nova Kit | 16 | ★★★★☆ | [3,3,4,3,3] | Brazilian grooves |
| `west-african-bell-kit` | West African Bell Kit | 12 | ★★★★☆ | [2,1,2,2,1,2,2] | Afro-percussion |
| `gahu-kit` | Gahu Kit | 16 | ★★★★☆ | [3,3,4,4,2] | Ewe traditional |
| `soukous-kit` | Soukous Kit | 16 | ★★★☆☆ | [3,3,4,1,5] | Congolese style |

## Integration Points

### For UI Component:
- `getRhythmPreset(id)` - для селекта пресетів
- `getPresetsByAuthenticity(n)` - для фільтрації
- `getPresetsWithVoice('kick')` - для інструмент-орієнтованого пошуку

### For MIDI Export:
- Всі пресети вже індексовані як `Track[]`
- Готові до `renderMidi(tracks, bars, bpm)`

## Track Parameters Explained

Кожен `Track` містить:
- `steps` - кількість тактів (8, 12, або 16)
- `hits` - кількість ударів для `euclid(hits, steps)`
- `rotation` - позиція відносно downbeat (-4 = 4 відлуння назад)
- `velocityPattern` - динаміка ударів [100, 80...]
- `playbackMode` - 'forward' (розширюється: 'reverse', 'pendulum', 'stutter')

## Next Steps for Implementation

1. Додати PresetSelector компонент в App.tsx
2. Додати кнопку "Load Preset" під транспортом  
3. Підключити до центрального store (або useState)
4. Додати візуалізацію вихідного паттерну в TrackCard

## Files Structure

```
src/presets/
├── historical-rhythms.ts  # Основний файл
└── index.ts              # Exports

public/presets/
└── historical-rhythms.json # JSON backup (для fetch)
```