# Historical Rhythm Presets Corpus

## Структура проєкту

```
euclidean-groove-lab/
├── HISTORICAL_PRESETS_AGENT_GUIDE.md    # Гайд для агента
├── src/presets/
│   ├── historical-rhythms.ts            # Основний TypeScript код (7 пресетів)
│   ├── index.ts                         # Exports: rhythmPresets, getRhythmPreset, ...
│   └── IMPLEMENTATION.md                  # Технічний гайд
└── public/presets/
    └── historical-rhythms.json            # JSON backup
```

## Рівень 1 - Дослідницькі картки

Директорія: `rhythm_taxonomy/`
- `level1_rhythms.md` - 10 ритмів з оцінкою достовірності ★☆-★★★★★
- `level2_presets.md` - Описи пресетів
- `index.md` - Швидка довідка
- `taxonomy.yaml` - Таксономія
- `presets/kick/` - 6 JSON файлів
- `presets/snare/` - 5 JSON файлів  
- `presets/hihat/` - 5 JSON файлів
- `presets/bass/` - 5 JSON файлів

## Рівень 2 - Готові до імпорту

### TypeScript (рекомендовано)
```typescript
import { rhythmPresets, getRhythmPreset } from './presets';

const preset = getRhythmPreset('clave-son-kit');
if (preset) setTracksState(preset.tracks);
```

### JSON (альтернатива)
```javascript
fetch('/presets/historical-rhythms.json')
  .then(r => r.json())
  .then(data => setTracksState(data.presets.find(p => p.id === 'clave-son-kit').tracks));
```

## 7 Пресетів

| # | Назва | Steps | Authenticity | Джерело |
|---|-------|-------|--------------|---------|
| 1 | Clave Son Kit | 16 | ★★★★★ | Куба/Гана/Ірак |
| 2 | Tresillo Kit | 8 | ★★★★★ | Куба |
| 3 | West African Bell Kit | 12 | ★★★★☆ | West Africa |
| 4 | Shiko Kit | 16 | ★★★★☆ | Nigeria/Caribbean |
| 5 | Gahu Kit | 16 | ★★★★☆ | Ghana/Ewe |
| 6 | Bossa Nova Kit | 16 | ★★★★☆ | Brazil |
| 7 | Soukous Kit | 16 | ★★★☆☆ | Congo |

## Діаграми

### Clave Son - Класичний latin house
```
Kick : [x x x . . x x x . x . . x .] має 4 удари
Snare: [. . x . . . . x . . . . . .] має 2 удари (rotation -4)
Hat  : вісімнадцяти потих [x x x x x x x x x x x x x x x x]
```

### Tresillo - Reggaeton core
```
Kick : [x . . x . . x .] (steps=8, hits=3)
Snare: [. x . . x . . x] (rotation=1)
Hat  : [x x x x] (steps=8, hits=4)
Bass : [x . . . x . . .] (hits=2)
```