# Multi-Kit Sample Engine — План реалізації

---

## 1. Модель даних

Новий файл `src/drumKits.ts` — чистий registry, без Tone.js, без React:

```ts
export type DrumKitId = 'cr78' | 'kit8' | 'kpr77';

export interface DrumKit {
  id: DrumKitId;
  name: string;
  description: string;
  kick: string;   // relative path from samples/
  snare: string;
  hat: string;
}

export const DRUM_KITS: Record<DrumKitId, DrumKit> = {
  cr78: {
    id: 'cr78',
    name: 'CR-78',
    description: 'Roland CR-78 CompuRhythm — vintage analog (1978)',
    kick: 'cr78/kick.wav',
    snare: 'cr78/snare.wav',
    hat: 'cr78/hihat.wav',
  },
  kit8: {
    id: 'kit8',
    name: 'Kit-8',
    description: 'Clean electronic kit — Chromium demo samples',
    kick: 'kit8/kick.wav',
    snare: 'kit8/snare.wav',
    hat: 'kit8/hihat.wav',
  },
  kpr77: {
    id: 'kpr77',
    name: 'KPR-77',
    description: 'Korg KPR-77 — analog rhythm machine',
    kick: 'kpr77/kick.wav',
    snare: 'kpr77/snare.wav',
    hat: 'kpr77/hihat.wav',
  },
};
```

### Чому kit8 і kpr77 замість tr808/tr909?

TR808 та TR909 директорії в Google Chrome Labs repo **порожні** (404 на всі файли).
Kit8 та KPR77 — фізично доступні, мають усі три WAV-файли, ліцензія Apache 2.0.

Додавання реальних TR808/TR909 можливе пізніше — достатньо додати рядки в `DRUM_KITS`.

---

## 2. Audio layer — `src/audio.ts`

### Поточна архітектура (спрощено)

```
start() → await Tone.start() → scheduler → voices[voiceId](time, velocity)
```

### Нова архітектура

```
start() → await Tone.start() → await loadDrumKit('cr78') → scheduler → voices[voiceId](time, velocity)
                                                                    ↑
switchDrumKit('kit8') → unload old Players → load new → update voices (scheduler не чіпати!)
```

### Ключові функції

```ts
let currentPlayers: { kick: Tone.Player; snare: Tone.Player; hat: Tone.Player } | null = null;
let currentKitId: DrumKitId = 'cr78';

/** Завантажити DrumKit (unload попередній, load новий). */
async function loadDrumKit(id: DrumKitId): Promise<void> {
  // 1. Dispose старих Player (якщо є)
  if (currentPlayers) {
    currentPlayers.kick.dispose();
    currentPlayers.snare.dispose();
    currentPlayers.hat.dispose();
    currentPlayers = null;
  }

  // 2. Визначити шляхи з registry
  const kit = DRUM_KITS[id];
  const base = '/euclidean-groove-lab/samples/';

  // 3. Створити нові Player
  const kick = new Tone.Player(base + kit.kick).toDestination();
  const snare = new Tone.Player(base + kit.snare).toDestination();
  const hat   = new Tone.Player(base + kit.hat).toDestination();

  // 4. Завантажити паралельно
  await Promise.all([kick.loaded(), snare.loaded(), hat.loaded()]);

  currentPlayers = { kick, snare, hat };
  currentKitId = id;
}

/** Публічний API для перемикання Kit з UI. */
export async function switchDrumKit(id: DrumKitId): Promise<void> {
  await loadDrumKit(id);
}
```

### Voice functions

```ts
const voices: Record<VoiceId, (time: number, velocity?: number) => void> = {
  kick: (time) => currentPlayers!.kick.start(time),
  snare: (time) => {
    if (velocity !== undefined && velocity !== 1) {
      currentPlayers!.snare.volume.value = linearToDb(velocity);
    }
    currentPlayers!.snare.start(time);
  },
  hat: (time, velocity = 1) => {
    currentPlayers!.hat.volume.value = linearToDb(velocity);
    currentPlayers!.hat.start(time);
  },
  bass: (time) => bass.triggerAttackRelease('E2', '8n', time),
};
```

### Bass — без змін

```ts
const bass = new Tone.Synth({
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.02, decay: 0.2, sustain: 0.15, release: 0.3 },
}).toDestination();
```

### start()

```ts
export async function start(initial: Track[], bpm: number): Promise<void> {
  primeAudioSession();
  await Tone.start();
  if (!currentPlayers) await loadDrumKit('cr78');
  currentTracks = initial;
  // scheduler без змін
}
```

---

## 3. UI — Drum Kit Selector

### Компонент

Новий простий компонент `DrumKitSelect.tsx`:

```tsx
import { DRUM_KITS } from '../drumKits';
import type { DrumKitId } from '../drumKits';

interface DrumKitSelectProps {
  value: DrumKitId;
  onChange: (id: DrumKitId) => void;
}

export default function DrumKitSelect({ value, onChange }: DrumKitSelectProps) {
  return (
    <label className="kit-select">
      Drum Kit:
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as DrumKitId)}
      >
        {Object.values(DRUM_KITS).map((kit) => (
          <option key={kit.id} value={kit.id}>
            {kit.name}
          </option>
        ))}
      </select>
    </label>
  );
}
```

### Інтеграція в App.tsx

```tsx
// State
const [kitId, setKitId] = useState<DrumKitId>('cr78');

// Callback
const handleKitChange = useCallback(async (id: DrumKitId) => {
  await switchDrumKit(id);
  setKitId(id);
}, []);

// JSX — додати в transport section
<DrumKitSelect value={kitId} onChange={handleKitChange} />
```

### Стилі (CSS, transport section)

```css
.kit-select {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-dim);
}
.kit-select select {
  background: var(--panel);
  color: var(--text-hi);
  border: 1px solid var(--rest);
  border-radius: 6px;
  padding: 4px 8px;
  font: inherit;
}
```

---

## 4. Оцінка складності

| Крок | Файли | Складність |
|---|---|---|
| 1. Створити `src/drumKits.ts` | 1 новий файл | ★☆☆ (5 хв) |
| 2. Оновити `src/audio.ts` (loadDrumKit, switchDrumKit, voices через players) | 1 файл | ★★☆ (20 хв) |
| 3. Створити `DrumKitSelect.tsx` | 1 новий файл | ★☆☆ (10 хв) |
| 4. Додати state + callback в `App.tsx` | 1 файл | ★☆☆ (5 хв) |
| 5. Додати CSS | 1 файл | ★☆☆ (5 хв) |
| 6. Завантажити WAV-файли (3 kits × 3 samples = 9 файлів) | 9 файлів | ★☆☆ (10 хв) |
| 7. npm test + npm run build | — | ★☆☆ (5 хв) |
| **Всього** | | **★☆☆ (~1 година)** |

---

## 5. Файлова структура (після змін)

```
public/samples/
├── cr78/
│   ├── kick.wav
│   ├── snare.wav
│   └── hihat.wav
├── kit8/
│   ├── kick.wav
│   ├── snare.wav
│   └── hihat.wav
└── kpr77/
    ├── kick.wav
    ├── snare.wav
    └── hihat.wav
src/
├── drumKits.ts          ← новий
├── audio.ts             ← оновлений
├── App.tsx              ← оновлений (+ state, callback)
├── components/
│   ├── DrumKitSelect.tsx ← новий
│   └── ...
└── engine/              ← без змін
```

---

## 6. Що НЕ змінюється

| Компонент | Статус |
|---|---|
| Engine (Track, trackPattern, computeVelocities, VELOCITY_PRESETS) | Без змін |
| Scheduler (global step, `step % track.steps`, 16n repeat) | Без змін |
| iOS hardening (primeAudioSession, onstatechange) | Без змін |
| Meta tags в index.html | Без змін |
| Tests (74/74) | Без змін (новий drumKits.ts не потребує тестів — статичні дані) |

---

## 7. Майбутнє розширення

Щоб додати новий DrumKit:

```ts
// Всього 1 рядок + 3 WAV файли:
export const DRUM_KITS = {
  // ... існуючі ...
  linn: {
    id: 'linn',
    name: 'LinnDrum',
    description: 'LinnDrum — 80s digital classic',
    kick: 'linn/kick.wav',
    snare: 'linn/snare.wav',
    hat: 'linn/hihat.wav',
  },
};
// UI select підхопить автоматично через Object.values()
```

Для TR808/TR909: знайти реальні семпли (Freesound.org, Archive.org, або придбані),
додати три WAV в `public/samples/tr808/` і один рядок в registry.

---

Чекаю рішення:
1. Чи схвалюєш Kit8 та KPR77 замість TR808/TR909 (поки не знайдено реальних семплів)?
2. Чи починаємо реалізацію за цим планом?