# Sample-Based Audio Engine — Architecture Plan

> **Status:** Design proposal, no code.
> **Context:** Current synthesized voices (Commit 2) sound worse than the
> earlier hybrid approach. User confirms synthesis quality is insufficient.
> Goal: design a sample-based layer that sounds good, stays small, and
> supports future Pitch Layer / MIDI Export / Harmonic Layer.

---

## 1. Tone.js Options — Порівняння

### Tone.Player

```
+-----------------------------+
|      Tone.Player            |
|  ┌─────────┐  ┌──────────┐ |
|  │ Buffer  │→│  Output  │ |
|  └─────────┘  └──────────┘ |
+-----------------------------+
```

**Що це:** Відтворює завантажений аудіофайл від початку до кінця. Має `playbackRate` (pitch shift), `start(time)`, `stop(time)`, `fadeIn`/`fadeOut`, `loop`.

| Аспект | Оцінка |
|---|---|
| **Підходить для** | Kick, Snare, Hat — one-shot семпли |
| **Кількість на трек** | 1 інстанція на семпл (4–8 для всього проєкту) |
| **Velocity** | `volume` або `gain` (ручне масштабування) |
| **Pitch shift** | `playbackRate` — змінює швидкість і висоту. Для драм-семплів небажано (змінює тембр), для перкусії прийнятно в межах ±6 semitones |
| **MIDI Export** | OK — тригер семпла = MIDI note-on |
| **Memory** | 1 AudioBuffer на семпл |
| **Розмір бандлу** | Малий (4–10 WAV файлів по 50–500 KB) |

### Tone.Sampler

```
+---------------------------------------------+
|            Tone.Sampler                      |
|  C2 ─── kick.wav                             |
|  D2 ─── snare.wav        ┌─────────┐        |
|  E2 ─── hat.wav          │ Output  │        |
|  A1..A3 ─ bass/ (multi)  └─────────┘        |
+---------------------------------------------+
```

**Що це:** Мапа MIDI-нот → семпли. Підтримує velocity layers (кілька семплів на одну ноту, різної гучності). Автоматично розтягує семпли між заданими нотами. Вбудований ADSR.

| Аспект | Оцінка |
|---|---|
| **Підходить для** | Bass (multisample across 2–3 octaves) |
| **Кількість на трек** | 1 інстанція на весь bass (вміщує всі семпли) |
| **Velocity** | Вбудована підтримка velocity layers |
| **Pitch shift** | Автоматичне мапування. Між заданими нотами — інтерполяція |
| **MIDI Export** | Ідеально — це вже MIDI-мапа |
| **Memory** | Більше (залежить від кількості семплів) |
| **Розмір бандлу** | 10–50 MB для якісного multisample bass |

### Рекомендація

| Голос | Інструмент | Чому |
|---|---|---|
| **Kick** | `Tone.Player` | One-shot, один семпл, без пітчінгу |
| **Snare** | `Tone.Player` | One-shot, один семпл |
| **Hat** | `Tone.Player` | One-shot, один семпл (closed hat) |
| **Bass** | `Tone.Player` + `playbackRate` **або** `Tone.Sampler` | Залежить від вибору (див. нижче) |

---

## 2. Bass — два варіанти

### Варіант A: Bass залишається синтезованим (Tone.Synth)

Після аналізу: проблема баса була **не в синтезі**, а в агресивному filterEnvelope MonoSynth.
Чистий `Tone.Synth({ oscillator: { type: 'triangle' } })` без фільтрації — це валідний
synth-bass, який використовується в багатьох треках.

**Плюси:** нульовий розмір завантаження, чистий звук, повний контроль ADSR.
**Мінуси:** менш "органічний", ніж семпл.

### Варіант B: Bass на Tone.Sampler

Один інструмент з 6–12 семплами чистої бас-гітари або синт-баса на різних нотах
(напр. E1, G1, A1, C2, E2, G2). Sampler інтерполює між ними.

**Плюси:** реалістичний бас, різні артикуляції.
**Мінуси:** розмір (~5–15 MB), складніше знайти якісні безкоштовні семпли.

---

## 3. Архітектура sample-based engine

### Схема даних

```
public/samples/
├── kick.wav         # Kick drum, one-shot, mono, ~200 KB
├── snare.wav        # Snare drum, one-shot, mono, ~200 KB
├── hat.wav          # Closed hi-hat, one-shot, mono, ~50 KB
└── bass/            # (optional — тільки якщо обираємо семпли для баса)
    ├── E1.wav
    ├── G1.wav
    ├── A1.wav
    ├── C2.wav
    └── E2.wav
```

### Код — структура аудіо-шару

```ts
// 1. Завантаження семплів
const BASE_URL = '/euclidean-groove-lab/samples/';

interface SampleMap {
  kick: Tone.Player;
  snare: Tone.Player;
  hat: Tone.Player;
  bass?: Tone.Player | Tone.Sampler;
}

async function loadSamples(): Promise<SampleMap> {
  const kick = new Tone.Player({ url: BASE_URL + 'kick.wav' }).toDestination();
  const snare = new Tone.Player({ url: BASE_URL + 'snare.wav' }).toDestination();
  const hat   = new Tone.Player({ url: BASE_URL + 'hat.wav' }).toDestination();

  // Завантаження паралельно
  await Promise.all([
    kick.loaded(),
    snare.loaded(),
    hat.loaded(),
  ]);

  return { kick, snare, hat };
}
```

### Voice functions — з velocity

```ts
const players!: SampleMap;

const voices: Record<VoiceId, (time: number, velocity?: number) => void> = {
  kick: (time) => {
    players.kick.start(time);
  },
  snare: (time) => {
    const vel = velocity ?? 1;
    players.snare.volume.value = linearToDb(vel); // -Infinity to 0 dB
    players.snare.start(time);
  },
  hat: (time, velocity = 1) => {
    players.hat.volume.value = linearToDb(velocity);
    players.hat.start(time);
  },
  bass: (time) => {
    // Tone.Synth(triangle) — без filterEnvelope
    // або players.bass.start(time) для семплованого
  },
};
```

### Velocity → гучність

```ts
function linearToDb(normalized: number): number {
  // normalized: 0.0 – 1.0
  // returns: -Infinity – 0 dB
  if (normalized <= 0) return -Infinity;
  return 20 * Math.log10(normalized);
}
```

### Ініціалізація

```ts
export async function start(initial: Track[], bpm: number): Promise<void> {
  primeAudioSession();
  await Tone.start();

  if (!players) {
    players = await loadSamples();
  }

  // ... решта scheduler без змін
}
```

### Сумісність з майбутніми фічами

| Фіча | Як впливає на семпли |
|---|---|
| **Pitch Layer** | Bass: Tone.Sampler або playbackRate. Drums: не пітчимо (семпли фіксовані) |
| **MIDI Export** | Кожен Tone.Player.start(time) = MIDI note-on. Bass Sampler = MIDI notes з pitches |
| **Harmonic Layer** | Bass Sampler підтримує різні ноти напряму. Для drums — не потрібно |
| **Velocity Ramp** | `volume.value = linearToDb(velocity)` — працює для всіх Tone.Player |
| **iOS / Telegram** | Не змінюється — primeAudioSession() вже є |

---

## 4. П'ять open-source / вільних drum kit ресурсів

| # | Набір | Ліцензія | Розмір | Стиль | Електронна музика |
|---|---|---|---|---|---|
| **1** | **[Samples from Mars — Mars 707](https://samplesfrommars.com/pages/mars-707)** | CC-BY | ~3 MB | TR-707 (цифрові драм-машини 80-х) | ✅ Відмінно |
| **2** | **[Hydrogen — GMKit](https://github.com/hydrogen-music/hydrogen/tree/master/data/drumkits)** | GPL / CC0 | ~2 MB | General MIDI, акустичний + електронний | ✅ Добре |
| **3** | **[Boris Smus — Web Audio Drum Samples](https://github.com/borismus/drum-samples)** | CC0 | ~600 KB | Мінімальні, чисті, для Web Audio API | ✅ Відмінно |
| **4** | **[Tidal Cycles — Dirt Samples](https://github.com/tidalcycles/Dirt-Samples)** | CC-BY-SA | ~4 MB | Електронні, хіп-хоп, експериментальні | ✅ Ідеально |
| **5** | **[Freesound.org — CC0 Drum Hits](https://freesound.org/search/?q=drum+kick&f=license:cc-zero)** | CC0 | Змінний | Будь-який (треба курувати) | ✅ Залежить від вибору |

### Деталі

#### 1. Samples from Mars — Mars 707 (CC-BY)
- TR-707 samples — чисті, сухі, готові до міксу
- Мають kick, snare, hat, toms, clap
- Стиль: електронна музика, synthwave, techno
- Розмір: ~3 MB за весь kit
- Ліцензія: CC-BY (потрібне зазначення авторства)
- **Найкращий вибір для цього проєкту**

#### 2. Hydrogen — GMKit (GPL / CC0)
- Стандартний General MIDI kit з Hydrogen drum machine
- Класичні драм-звуки, акустичні + електронні
- Розмір: ~2 MB
- Ліцензія: GPL (код) / CC0 (семпли в деяких версіях)
- Добре як fallback

#### 3. Boris Smus — Web Audio Drum Samples (CC0)
- Спеціально створені для Web Audio API
- Kick, snare, hat, clap, tom — базовий набір
- Розмір: ~600 KB (найменший варіант)
- Ліцензія: CC0 (жодних обмежень)
- Ідеально для мінімального розміру бандлу
- **Найкращий для GitHub Pages (малий розмір)**

#### 4. Tidal Cycles — Dirt Samples (CC-BY-SA)
- Велика колекція семплів для live coding
- Багато kick/snare/hat варіантів
- Розмір: ~4 MB для базового набору
- Стиль: електронна, IDM, glitch, hip-hop
- Ліцензія: CC-BY-SA (копілефт)

#### 5. Freesound.org CC0 (CC0)
- Величезна база, можна вибрати найкращі семпли
- Потрібно курувати вручну (знайти, скачати, нормалізувати)
- Розмір: контрольований
- Ліцензія: CC0 — жодних обмежень

---

## 5. План міграції

### Фаза 1 — Drums на семплах, Bass на чистому Synth

1. Вибрати drum kit (пропоную Boris Smus — найменший, CC0, готовий для Web)
2. Додати WAV файли в `public/samples/`
3. Замінити `NoiseSynth` / `MetalSynth` / `MembraneSynth` на `Tone.Player`
4. Bass повернути на `Tone.Synth({ oscillator: { type: 'triangle' } })` + E2
5. Залишити velocity engine, iOS hardening, scheduler — без змін

**Результат:** 4 треки, з яких 3 — реальні записи драм-машини, 1 — чистий синтезований бас.

### Фаза 2 (опціонально) — Bass на Tone.Sampler

1. Знайти якісний multisample bass (або записати/насинтезувати)
2. Додати семпли в `public/samples/bass/`
3. Замінити `Tone.Synth` на `Tone.Sampler` з мапою нот
4. Оновити voice function для bass

---

## 6. Сумарний розмір (Фаза 1)

| Компонент | Розмір |
|---|---|
| Kick WAV | ~150–300 KB |
| Snare WAV | ~150–300 KB |
| Hat WAV | ~30–80 KB |
| Bass (Synth) | 0 KB |
| **Всього** | **~330–680 KB** |

Для GitHub Pages це ідеально — додаткове завантаження менше за 1 секунду при 4G.

---

**Чекаю рішення:** який drum kit обираємо, і чи йдемо по Фазі 1 (бас на Synth) чи одразу Фаза 2 (бас на Sampler)?