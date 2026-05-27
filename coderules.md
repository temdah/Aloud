# Code Rules

Conventions for this codebase. Follow them for all new code and refactors.

## 1. Project structure (layered + per-component/screen folders)

```
PDFReader/
  App.tsx                      # root component (providers + entry render)
  index.ts                     # Expo entry → imports ./App
  src/
    components/                # ALL reusable UI, flat (no feature grouping)
      <Name>/
        <Name>.tsx
        <Name>.styles.ts
        index.ts               # export { <Name> } from './<Name>'
      index.ts                 # barrel: export * from './<Name>'
    screens/
      <Name>Screen/
        <Name>Screen.tsx
        <Name>Screen.styles.ts
        index.ts
    navigation/                # navigators (AppNavigator.tsx, *.styles.ts, types/)
    types/                     # shared/domain types (icon.ts, library.ts, …)
    theme/                     # design tokens + ThemeProvider/useTheme
    supertonic/                # the on-device TTS engine (domain module)
```

- Top-level folders are **layered** (by kind). Add `hooks/`, `stores/`, `utils/`,
  `api/` only when they have real content — **never create empty folders**.
- **Every UI component lives in its own folder** under `src/components/`, flat —
  feature-specific components (e.g. `BookRow`, `VoicePicker`) sit alongside
  primitives (`Button`, `Icon`). If it renders UI, it's a `components/<Name>/`.
- **Every screen** is a `src/screens/<Name>Screen/` folder.
- `App.tsx` lives at the **project root**, not in `src/`.

## 2. Naming
- Component/screen folders and their `.tsx`/`.styles.ts` files: **PascalCase**
  (`Button/Button.tsx`).
- Other modules and type files: **camelCase** (`modelCatalog.ts`, `voice.ts`).
- Barrels are always `index.ts`.
- **Names describe exactly what the file is.** No abbreviations, cryptic names,
  or milestone codes (never `M0Screen.tsx` — name it for what it does).

## 3. Components
- One component per folder; one responsibility per file (SOLID, modular).
- `index.ts` re-exports the component (`export { Button } from './Button'`).
- Components read theme via `useTheme()` — they do **not** take a `palette`
  prop.

## 4. Screens
- Compose components only; no bespoke UI primitives defined inside a screen.
- Default-export the screen; the folder `index.ts` re-exports it.

## 5. Styles & theming
- **All design values come from `src/theme`** — never hardcode colors, spacing,
  radii, font sizes, or fonts. Use `useTheme().palette`, `ty(TYPE.x, color)`,
  `TYPE`, `SPACE`, `RADIUS`, `elevation(level)`.
- Styles live in a co-located `<Name>.styles.ts`:
  ```ts
  import { StyleSheet } from 'react-native';
  import type { Palette } from '../../theme';

  export const makeStyles = (p: Palette) =>
    StyleSheet.create({ container: { backgroundColor: p.surface, padding: 16 } });
  ```
  ```ts
  // in <Name>.tsx
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  ```
- **Only static or palette-derived values go in the StyleSheet.** Anything that
  depends on a **prop or state** (e.g. a `selected` background, a percentage
  width, a `pressed` transform) stays **inline** as a style-array override —
  never freeze a prop/state-dependent value into a StyleSheet.

## 6. Imports
- **Within `src/components/`, import sibling components by direct path**
  (`import { Icon } from '../Icon'`). Do **not** import the `components` barrel
  from inside `components/` — it creates a circular dependency.
- **Screens, navigation, and everything else import components via the barrel**
  (`import { Button, Icon } from '../../components'`) — shortest path, no cycle.
- Theme: `'../../theme'`. Shared types: `'../../types'`. Engine: `'../../supertonic'`.

## 7. Types
- **Shared/domain types live in their own files** under `src/types/` with a
  barrel (`types/index.ts`). Do not leak shared types into logic files.
- Component-specific prop interfaces may stay co-located in the component `.tsx`.

## 8. Data — no mock content
- **No mock/sample/placeholder data in the app.** No fake records, timers, or
  hardcoded values (sizes, timestamps, names). Build screens **data-driven with
  empty defaults and typed props**, and render proper **empty states**.
- Real catalog data that genuinely exists (e.g. the model's voice ids
  F1–F5 / M1–M5) is fine; invented names/descriptions/progress are not.

## 9. Architecture & native dependencies
- The app runs on React Native's **old architecture** (`newArchEnabled=false`),
  required by `onnxruntime-react-native` (the TTS engine). **Do not enable the
  New Architecture.**
- Therefore New-Architecture-only libraries (`react-native-reanimated` 4,
  `@gorhom/bottom-sheet`) are **not allowed**. Use built-in `Animated`,
  `Modal`, and `PanResponder`.

## 10. Commits & repo hygiene
- Commit messages use a **Conventional-Commits type with NO scope**:
  `type: summary` (`feat`, `fix`, `refactor`, `chore`, …) — never
  `type(scope): summary`. Lowercase imperative summary, then a **blank line**,
  then a `-` bulleted body describing what was done. Example:
  ```
  feat: headless PDF.js text extraction feeding the reader

  - Bundle pdfjs-dist (ESM) + viewer.html as Metro assets
  - Cache extracted text per doc; build + persist the chunk manifest
  ```
- Keep AI-assistant artifacts out of the repo (`.claude/`, `CLAUDE.md`,
  `handoff.md` are gitignored; no `Co-Authored-By` assistant trailers).
- Generated native folders (`android/`, `ios/`) and `node_modules/` are
  gitignored; native setup is reproduced from `app.json`, the postinstall
  patch, and the Expo config plugins.
