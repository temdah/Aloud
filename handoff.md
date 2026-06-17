# Aloud — Engineering Handoff

Living continuity doc for the **Aloud** offline Android read-aloud app.
Expo SDK 56 · RN 0.85 · TypeScript · package `com.tim.aloud`.

---

## What the app is

Fully-offline read-aloud reader. Import a PDF / Markdown / Word file, tap any
sentence, and an on-device TTS engine (Supertonic, ONNX) reads from there. Audio
is cached per-document so re-listening is instant. A "make full audiobook"
pre-render path renders the whole document up front.

### Key architecture (load-bearing facts)

- **TTS engine:** Supertonic, 4-stage ONNX pipeline (duration predictor → text
  encoder → vector estimator → vocoder). Two builds: `supertonic-2` (263 MB, 5
  langs: en/ko/es/pt/fr, faster) and `supertonic-3` (398 MB, 31 langs, higher
  quality). Voices = `F1–F5` / `M1–M5`, default `M1`. **Voices are pure style
  embeddings (`voice_styles/<id>.json`), language-independent** — any voice can
  speak any language the model supports.
- **Cache keying:** `settingsHash = stableHash('v3|modelId|voiceId|steps|lang')`
  — **speed is deliberately excluded** (applied live via playback rate). Files at
  `documentDirectory/tts/<docHash>/<charStart>-<settingsHash>.wav` (+ `.timing.json`),
  plus `profiles.json` (voice registry), `manifest.json`. Multiple voices coexist
  on disk, distinguished by hash suffix. `stableHash` is FNV-1a base36 (no dashes).
- **Per-doc pinning:** `renderProfile` (per-doc `NarrationSettings`) + `audiobook`
  (per-doc state w/ single `profileHash`) pin ONE profile for a fully-rendered
  audiobook. Reader uses `effVoiceId = renderProfile?.voiceId ?? voiceId`,
  `effLang = renderProfile?.lang ?? doc?.lang ?? settingsLang ?? 'en'`.
- **Playback is global:** `usePlayback` lives in `PlaybackProvider` mounted once
  at App root, never unmounted → engine (`TextToSpeech` + `VoiceStyle`) stays
  resident for the session; mini-player survives leaving the reader.
- **Playback model:** sequence of separate per-chunk WAV files via expo-audio
  `player.replace()`. OS lock-screen transport is handled natively (no JS hook
  for seek buttons). `PREFETCH_AHEAD` fixed at 4.

### Build & distribution

- arm64-only fast build: `-PreactNativeArchitectures=arm64-v8a`.
- APK output: `android/app/build/outputs/apk/release/app-release.apk` (~64 MB).
- `expo prebuild --clean` regenerates `gradle.properties` (wipes manual ABI edits).
- iOS: never built; would need TestFlight + EAS + $99 Apple account.

---

## Standing constraints (do not violate)

- **Ask before adding ANY native dependency** (forces a native rebuild).
- **Never run git.** Provide Conventional Commit message text only
  (`type: summary`, no scope, blank line, `- bullets`).
- **Never auto-test / auto-launch / auto-poll on device** (device is
  deliberately disconnected).
- **Always propose the approach and get a go-ahead before implementing.**
- Monetization ideas must **not** be written into `future-work.md`.

---

## Recently completed

- **Per-voice cache management** — `profiles.json` registry; `ManageCacheSheet`
  surfaced in reader overflow + library long-press + a global Storage screen;
  per-voice delete + clear-all.
- **Voice-switch warning on cached audio** — switching the voice on a document
  with cached audio warns, then actually repoints `renderProfile` and clears the
  stale `audiobook` so new audio is generated with the new voice.
- **Empty-library entrance animation** — middle book fades in, side books spread
  open (`Easing.out(back)`), typewriter title (layout reserved to avoid reflow),
  import button pop + secondary bounce. ~1.8 s total.
- **Reader UI cleanup** — working "..." overflow (Change voice · {name},
  Language · {name}, Make full audiobook, Manage cached audio, Delete); moon
  sleep button replaced the dead voice text; "Follow" → "Read along" chip.
- **Prerender hang + MiniPlayer gating** fixed (commit `3a92466`).
- **Sleep timer** — basic 15/30/45/60 min implemented.

---

## Planned work (the backlog we're choosing from)

### A. Custom voices + legal (biggest net-new chunk; items couple together)
1. **Import a voice-style file** — voices are just style JSONs, so import + register
   in `AVAILABLE_VOICES` is feasible fully offline. Needs a "Voices" management
   screen + native file picker + a "browse voices" entry that opens the native
   browser.
2. **TOS gate on import** — consent copy: "we do not condone using copyrighted
   voices," shown before an import completes.
3. **App-level copyright TOS** — broader disclaimer: modular system, we don't
   supply voices, can't control user behaviour. UI + consent checkbox; no native
   deps.

### B. Performance (JS-only, low risk, no rebuild)
- **Smarter prefetch** — make `PREFETCH_AHEAD` adaptive (further ahead when
  synthesis beats realtime, throttle when struggling, prioritise next chunk).
- **Async cache writes** — keep WAV writes off the synthesis loop; update manifest
  atomically.

### C. Reading features (JS-only, medium effort)
- **In-document search** — find text, start narration from a hit.
- **Resume after reboot / app kill** — restore last position, optionally re-arm
  the media notification.

### D. Deferred (need a native dep / rebuild — get approval first)
- **Compress cached audio (WAV→Ogg Vorbis)** — no pure-JS encoder; needs a
  native libvorbis JNI bridge (local Expo module). Vorbis over Opus because the
  model is 44.1 kHz (Opus would need a resampler). ~10× smaller cache + faster IO.
- **Per-word karaoke** — Supertonic emits no per-word timestamps; needs forced
  alignment (likely native). Crude char-weighted fallback is the only no-dep path.
- **True OS Stop button / cross-clip −10s seek** — would require swapping
  expo-audio for `react-native-track-player`.
