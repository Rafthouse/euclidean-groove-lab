# Audio QA — Hi-Hat Replacement + Bass Design

## A. Hi-Hat Samples — Аналіз

### Поточний стан

| Kit | hat file | Розмір | Проблема |
|---|---|---|---|
| CR-78 | `cr78/hihat.wav` | 16 KB | ✅ Не згадується в скаргах |
| Kit-8 | `kit8/hihat.wav` | 30 KB | ❌ Finger click / percussion |
| KPR-77 | `kpr77/hihat.wav` | 71 KB | ❌ Metallic rail / percussion hit |

### Доступні альтернативи в Chrome Labs

| Kit | hihat.wav | Розмір | Характер (очікуваний) |
|---|---|---|---|
| **4OP-FM** | `4OP-FM/hihat.wav` | **188 KB** | FM-синтез (Yamaha DX-7 style). Великий файл = складний спектр. Ймовірно якісний closed hat |
| **Kit3** | `Kit3/hihat.wav` | 31 KB | Електронний, схожий на Kit8 |

**4OP-FM** — найперспективніша заміна. 4-операторний FM-синтез дає складний металевий тембр, який може звучати як якісний електронний hi-hat. 188 KB вказує на довший/детальніший семпл.

### Пропозиція

| Kit | Нова hat | Джерело |
|---|---|---|
| CR-78 | `cr78/hihat.wav` | Без змін |
| Kit-8 | → `4op-fm/hihat.wav` | 4OP-FM kit (найбільш відмінний, FM-характер) |
| KPR-77 | → `kit3/hihat.wav` | Kit3 hihat (нейтральний електронний hat) |

DrumKit registry змінюється тільки в шляхах файлів — архітектура не зачіпається:

```ts
kit8: {
  // ...
  kick: 'kit8/kick.wav',    // kick залишається
  snare: 'kit8/snare.wav',  // snare залишається
  hat: '4op-fm/hihat.wav',   // ← hat з 4OP-FM
},
kpr77: {
  // ...
  hat: 'kit3/hihat.wav',     // ← hat з Kit3
},
```

Файли вже доступні на GitHub raw. Жодних нових джерел.

---

## B. Bass — 3 варіанти

### Варіант 1 — Tone.Synth з sawtooth + gentle lowpass

```ts
const bass = new Tone.Synth({
  oscillator: { type: 'sawtooth' },     // ← багато гармонік
  envelope: { attack: 0.008, decay: 0.25, sustain: 0.2, release: 0.3 },
}).toDestination();

// Gentle lowpass filter after the synth
const bassFilter = new Tone.Filter(1200, 'lowpass').toDestination();
bass.connect(bassFilter);
```

**Як працює:** Sawtooth дає всі гармоніки (1f, 2f, 3f, 4f…). Lowpass на 1200 Гц зрізає занадто високі, залишаючи середину. Ніякого filterEnvelope — частота фіксована.

| Критерій | Оцінка |
|---|---|
| **Pick-bass характер** | ⚠️ Середина — sawtooth має багато гармонік, але відчувається як синтезатор, а не як електричний бас |
| **Читабельність на ноутбуці** | ✅ Багато енергії в міді (500–1200 Гц) |
| **Не суббас** | ✅ |
| **Pitch Layer** | ✅ Synth — чиста частота, будь-яка нота, ніяких артефактів |
| **MIDI Export** | ✅ Транспонується вільно |
| **Розмір** | 0 KB |
| **Складність** | ★☆☆ |

### Варіант 2 — Tone.MonoSynth з sawtooth + фіксований filter (без sweep)

```ts
const bass = new Tone.MonoSynth({
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 0.008, decay: 0.25, sustain: 0.2, release: 0.3 },
  filter: { type: 'lowpass', Q: 0.7, frequency: 800, rolloff: -12 },
  // filterEnvelope — НЕ використовуємо (no sweep)
}).toDestination();
```

**Ключова відмінність від минулого:** filterEnvelope з октавним sweep був проблемою. Тут filter — статичний lowpass, який тільки пом'якшує sawtooth.

| Критерій | Оцінка |
|---|---|
| **Pick-bass характер** | ✅ Багатший за простий Synth. Вбудований фільтр дає тепліший тон |
| **Читабельність на ноутбуці** | ✅ Sawtooth + lowpass (800 Гц) — максимум енергії в мідбасі |
| **Не суббас** | ✅ |
| **Pitch Layer** | ✅ Те саме — чиста частота |
| **MIDI Export** | ✅ |
| **Розмір** | 0 KB |
| **Складність** | ★☆☆ |

### Варіант 3 — Sample-based bass (Tone.Player + playbackRate)

```ts
// Одна нота E2, stretched для інших нот через playbackRate
const bass = new Tone.Player('/euclidean-groove-lab/samples/bass/e2.wav');
bass.toDestination();

// Voice function з pitch shift
bass: (time, note = 'E2') => {
  const targetFreq = Tone.Frequency(note).toFrequency();
  const baseFreq = Tone.Frequency('E2').toFrequency();
  bass.playbackRate = targetFreq / baseFreq;
  bass.start(time);
}
```

**Або Tone.Sampler** з multisample:

```ts
const bass = new Tone.Sampler({
  urls: {
    'E1': 'bass/e1.wav',
    'A1': 'bass/a1.wav',
    'E2': 'bass/e2.wav',
    'A2': 'bass/a2.wav',
  },
  baseUrl: '/euclidean-groove-lab/samples/',
}).toDestination();
```

| Критерій | Оцінка |
|---|---|
| **Pick-bass характер** | ✅ Максимально реалістичний (якщо знайти якісний семпл) |
| **Читабельність на ноутбуці** | ✅ Реальний запис має природні гармоніки |
| **Не суббас** | ✅ |
| **Pitch Layer** | ❌ `playbackRate` stretch змінює тембр. Для >±6 семітонів — чутно деградацію. Sampler краще, але потребує 4+ семплів |
| **MIDI Export** | ⚠️ З pitch shift — необхідно нормалізувати ноти на експорті |
| **Розмір** | 100–500 KB (1 sample) або 1–3 MB (multisample) |
| **Складність** | ★★☆ (потрібно знайти/підготувати семпли) |

---

## Рекомендація

### Drums — Hi-Hat

| Kit | Новий hat | Статус |
|---|---|---|
| CR-78 | Без змін | ✅ |
| Kit-8 | **4OP-FM hihat.wav** — FM-синтез, 188 KB, насичений closed-hat спектр |
| KPR-77 | **Kit3 hihat.wav** — нейтральний електронний hat |

Мінімальна зміна: тільки шляхи в `DRUM_KITS`, жодної нової архітектури.

### Bass — Варіант 2: Tone.MonoSynth + sawtooth + static filter

Рекомендую **Варіант 2** (MonoSynth без filterEnvelope).

**Чому не Варіант 1 (Synth):** Synth + sawtooth без фільтра звучить занадто різко. Зовнішній `Filter` (Варіант 1) працює, але MonoSynth має вбудований filter як першокласну фічу — використовувати його правильно, а не дублювати зовнішньою нодою.

**Чому не Варіант 3 (sample):** Для Pitch Layer і Harmonic Layer синтезований бас — єдиний правильний вибір. Семпл з playbackRate деградує при транспонуванні на октаву. Sampler потребує 4+ семплів, що ускладнює проєкт без явної переваги.

**Ключова зміна порівняно з попереднім MonoSynth:** filterEnvelope **відсутній**. Ніякого sweep, ніякого auto-wah. Тільки статичний lowpass для тепла і sawtooth для гармонік.

```ts
const bass = new Tone.MonoSynth({
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 0.008, decay: 0.25, sustain: 0.2, release: 0.3 },
  filter: { type: 'lowpass', Q: 0.7, frequency: 800, rolloff: -12 },
  // filterEnvelope not set — static filter only
}).toDestination();
```

### Очікуваний звук

- **Атака:** sawtooth + lowpass 800 Гц → багато гармонік, pluck-подібний початок
- **Спад:** 0.25s, природний для 16-нотного баса
- **Спектр:** гармоніки до 800 Гц — читабельно на будь-яких колонках
- **Порівняно з triangle:** значно більше mid-range енергії, менше суббасу
- **Порівняно з MonoSynth+filterEnvelope:** стабільний тембр, без модуляції на кожній ноті

---

Чекаю рішення: чи схвалюєш заміну hat (Kit8→4OP-FM, KPR77→Kit3) та bass → MonoSynth sawtooth + static filter?