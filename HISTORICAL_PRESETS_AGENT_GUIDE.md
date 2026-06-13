# HISTORICAL RHYTHM PRESETS - AGENT IMPLEMENTATION GUIDE

## Quick Start

```bash
# Вже створені файли:
src/presets/historical-rhythms.ts  # TypeScript код
src/presets/index.ts              # Exports
public/presets/historical-rhythms.json # JSON backup
```

## Integration Steps

### 1. Import в ваш компонент

```typescript
// Додайте в App.tsx або окремий PresetManager.tsx
import { rhythmPresets, getRhythmPreset } from './presets';
import type { Track } from './engine';

// Або для JSON версії:
const presets = await fetch('/presets/historical-rhythms.json').then(r => r.json());
```

### 2. UI: Preset Selector

```tsx
const [selectedPresetId, setSelectedPresetId] = useState<string>('clave-son-kit');

const handlePresetLoad = (presetId: string) => {
  const preset = getRhythmPreset(presetId);
  if (preset) {
    setTracksState(preset.tracks); // ВАШ STATE SETTER
  }
};

// У JSX:
<select onChange={(e) => handlePresetLoad(e.target.value)}>
  {rhythmPresets.map(preset => (
    <option key={preset.id} value={preset.id}>
      {preset.name} ★{preset.authenticity}
    </option>
  ))}
</select>
```

## Preset Data Summary

| ID | Name | Steps | Authenticity | Pattern | Kick Hits | Snare Hits | Hat Hits | Bass Hits |
|----|------|-------|--------------|---------|-----------|------------|----------|-----------|
| shiko-kit | Shiko | 16 | 4 | [4,2,4,2,4] | 3@0 | 1@5 | 8@0 | 1@3 |
| clave-son-kit | Clave Son | 16 | 5 | [3,3,4,2,4] | 4@0 | 3@-4 | 8@0 | 3@1 |
| tresillo-kit | Tresillo | 8 | 5 | [3,3,2] | 3@0 | 3@1 | 4@0 | 2@0 |
| bossa-nova-kit | Bossa Nova | 16 | 4 | [3,3,4,3,3] | 5@0 | 2@6 | 8@2 | 3@0 |
| west-african-bell-kit | West African Bell | 12 | 4 | [2,1,2,2,1,2,2] | 5@0 | 5@1 | 6@0 | 4@0 |
| gahu-kit | Gahu | 16 | 4 | [3,3,4,4,2] | 5@0 | 2@4 | 8@0 | 2@0 |
| soukous-kit | Soukous | 16 | 3 | [3,3,4,1,5] | 5@0 | 4@2 | 8@0 | 3@0 |

## Preset Schema

```typescript
interface RhythmPreset {
  id: string;                  // унікальний ідентифікатор
  name: string;                // назва для UI
  description: string;          // tooltip/description
  source_rhythm?: string;       // джерело (Toussaint)
  source_pattern?: number[];    // інтервали між ударами
  authenticity?: number;      // рейтинг 1-5 зірочок
  tracks: Track[];              // масив з 4 треків
}

// Track має наступні поля (вже сумісні з engine):
interface Track {
  id: 'kick' | 'snare' | 'hat' | 'bass';
  name: string;
  steps: number;               // кількість підділів
  hits: number;                // кількість ударів (euclid)
  rotation: number;            // зсув відносно downbeat
  mute: boolean;
  solo: boolean;
  voiceId: 'kick' | 'snare' | 'hat' | 'bass';
  volume: number;              // 0-100
  playbackMode: 'forward';      // готово для майбутніх mode-ів
  playbackSpeed: number;        // 1 = норма, 2 = подвоєння
  velocityPattern?: number[];   // динаміка [100, 80...]
}
```

## Helper Functions

```typescript
// Отримати пресет за ID
getRhythmPreset('clave-son-kit')

// Пресети з високою достовірністю (5 зірочок)
getPresetsByAuthenticity(5)

// Пресети які містять конкретний інструмент
getPresetsWithVoice('kick') // поверне всі пресети (вони всі містять kick)
```

## File Locations

```
euclidean-groove-lab/
├── src/
│   ├── presets/
│   │   ├── historical-rhythms.ts ✓ (TypeScript)
│   │   ├── index.ts ✓ (exports)
│   │   └── IMPLEMENTATION.md (цей файл)
│   └── engine/
│       └── track.ts (Track тип - вже сумісний)
├── public/
│   └── presets/
│       └── historical-rhythms.json ✓ (JSON backup)
```

## Integration Checklist

- [ ] Додати import в App.tsx: `import { rhythmPresets } from './presets'`
- [ ] Створити PresetSelector компонент
- [ ] Додати обробник `setTracksState(preset.tracks)`
- [ ] Додати опцію "Load Preset" в UI
- [ ] (Опціонально) Додати відображення `source_pattern` в TrackCard
- [ ] (Опціонально) Додати фільтрацію за `authenticity`

## Testing

Після інтеграції перевірте:
1. Клейв Сон - має давати 4 удари kick (позиції 0,3,8,11)
2. Тресільо - 8-тактовий (steps=8, hits=3 для kick)
3. West African Bell - 12-тактовий (steps=12)

## Notes

- Всі пресети використовують `playbackMode: 'forward'` - сумісно з поточною логікою
- Rotation може бути від'ємним (напр. -4 означає 4 кроки назад від кінця)
- Velocity patterns готові до використання з aceent UI