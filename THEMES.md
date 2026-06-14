# Euclidean Modular — Theme Registry

Список всіх тем для легкого відновлення.
Стейт від `a3ae820` (вечір 13 червня 2026).

| ID | Назва | Опис | Статус |
|---|---|---|---|
| `neon-void` | Dark Neon | Tokyo neon. Synthwave glow. Cyberpunk. | ✅ |
| `paper` | Vintage Paper | Warm parchment, amber ink, aged manuscript. | ✅ |
| `elements` | Elements | Default — minimal, clean, hardware-agnostic. | ✅ |
| `military` | Tactical | Olive drab, mil-spec, field ops. | ✅ |
| `old-school` | Old-school | Amber CRT terminals, retro computing. | ✅ |
| `cherry` | Cherry | Sakura petals, deep red, delicate. | ✅ |
| `nostradamus` | Nostradamus | Occult grimoire, dark academia. | ✅ |
| `big-boss` | Big Boss | Tactical military, muted tech. | ✅ |
| `university` | University | Ivory tower, chalkboard, warm light. | ✅ |
| `neon-void` | Neon Void | Deep space, magenta-cyan neon. | ✅ |
| `dark-side` | Dark Side | Red alert, Imperial, stark contrast. | ✅ |
| `bauhaus` | Bauhaus | Geometric, primary colors, 1920s. | ❌ нема CSS |
| `smoke-dub` | Smoke Dub | Dive bar haze, bassweight culture. | ❌ нема CSS |
| `nautilus` | Nautilus | Deep ocean, bioluminescent, abyssal. | ❌ нема CSS |
| `satisfaction` | Satisfaction | Groovebox, FruityLoops 2.x, Electribe. | 🔴 REMOVED |
| `revelation` | Ashes | Cold observatory, weathered silver. | ✅ |
| `high-contrast` | High Contrast | Maximum legibility, a11y-first. | ✅ |
| `candyflip` | Candyflip | Pastel neon, rave flyer, festival. | ✅ |
| `barbie` | Barbie | Magenta excess, plastic fantastic. | ✅ |
| `alchemy` | Alchemy | Cyan depths, glowing formulas. | ✅ |
| `beekeeper` | Beekeeper | Honeycomb amber, hexagonal warmth. | ✅ |

## Де знаходяться теми

- **CSS-змінні (колірна схема)**: `src/style.css` — кожна тема це `:root[data-theme='...'] {}`
- **HTML select options**: `src/App.tsx` — `<select>` з `<option value="...">`
- **TypeScript тип**: `src/App.tsx` — `type ThemeId = '...' | '...'`
- **localStorage валідація**: `src/App.tsx` — `initialTheme()` повертає дефолт `'elements'`

## Відновлення видалених тем

Якщо потрібно відновити `satisfaction`, `bauhaus`, `smoke-dub` або `nautilus`:
```
git log --all --oneline --grep="theme"
```
І знайти відповідний коміт.
