# Future Work

Backlog of larger initiatives beyond the current milestones (M3 background audio, M4 release hardening).
Each item lists the goal, a concrete approach, and where it touches the codebase.

---

## 1. Speed & performance of synthesis / caching

**Goal:** lower time-to-first-audio and keep narration ahead of playback, especially on mid-range Android.

**Approach**
- **ONNX execution providers** — we currently run Supertonic on CPU. Try NNAPI / XNNPACK / GPU (`onnxruntime-react-native` session options) and measure per-step inference time. Fall back to CPU when a provider is unavailable.
- **Quantized models** — offer int8/fp16 model variants in the catalog. Smaller download, faster inference, slight quality trade-off; expose as a "Performance" quality tier alongside Supertonic 2/3.
- **Fewer diffusion steps** — `steps` is already a setting; tune a default that balances quality vs. latency and surface a "Faster / Better" toggle instead of a raw number.
- **Keep the engine resident** — `loadTextToSpeech`/`loadVoiceStyle` should be loaded once and shared (a module-level singleton or context) rather than reloaded per screen, so re-entering the reader doesn't pay cold-load cost again.
- **Smarter prefetch** — `PREFETCH_AHEAD` is a fixed 4 in `usePlayback`. Make it adaptive: prefetch further when synthesis is faster than realtime, throttle when the device is struggling, and prioritize the *next* chunk over deep look-ahead.
- **Compress cached audio** — the cache stores raw WAV (`wavEncoder`), which is large and slow to write. Encoding to Opus/AAC would cut cache size ~10x and speed up file IO; verify expo-audio can play the chosen container. Keep WAV as a fallback.
- **Async cache writes** — ensure WAV/Opus writes don't block the synthesis loop; write in the background and update the manifest atomically.

**Touches:** `src/supertonic/synthesis/*`, `src/supertonic/narration/{narrator,audioCache,manifest}.ts`, `src/hooks/usePlayback.ts`, `modelCatalog.ts`.

---

## 2. Custom / trained voices

**Goal:** let a user use a voice that isn't in the built-in catalog.

**Approach (easiest → hardest)**
- **Import a voice-style file** — Supertonic voices are reference *style* embeddings (`loadVoiceStyle`). Add a flow to import a `.bin`/style file and register it in `AVAILABLE_VOICES`, so power users can drop in community voices offline.
- **Zero-shot cloning from a sample** — if the model supports reference-audio conditioning, add "record 10–30s of your voice" → extract a style vector on-device → save as a custom voice. This is inference, not training, so it can stay fully offline.
- **Full fine-tuning** — true model training is not feasible on-device. If pursued, it would be an optional cloud step (out of the "fully offline" promise) that returns a downloadable voice file the app then uses offline. Flag the privacy/offline trade-off clearly before building.

**Touches:** `src/supertonic/models/*` (catalog + storage), `src/supertonic/synthesis/voiceStyle.ts`, new "Voices" management screen, mic permission.

**Open question:** does the current Supertonic build expose a reference-audio → style-embedding path, or only the fixed prebuilt voices? Confirm before committing to (2)/(3).

---

## 3. Find performance bottlenecks

**Goal:** know *where* the time and memory actually go before optimizing.

**Approach**
- **Instrument the pipeline** — add timing around each stage: PDF.js extraction, chunking, per-step ONNX inference, WAV encode, file write, `player.replace`. Log a "time-to-first-audio" metric (tap → sound) and a "realtime factor" (audio seconds produced per wall-clock second).
- **Dev perf HUD** — a debug overlay (dev builds only) showing last synthesis time, cache hit/miss, prefetch depth, and memory, so regressions are visible during normal use.
- **Native profiling** — Android Studio profiler / `systrace` for the ONNX inference and IO; React DevTools Profiler for render churn in the reader (the virtualized pager and highlight updates are the likely JS hot spots).
- **Cold vs. warm** — measure first-open of a document vs. cached re-open separately; they have very different bottlenecks (extraction/synthesis vs. file IO).

**Touches:** lightweight timing util in `src/utils`, optional debug overlay component, no production behavior change.

---

## 4. Other ideas to make the app feel complete

- **Per-word highlight (karaoke)** — the deferred "Map B" word-level timing; highlight the spoken word, not just the chunk. Biggest perceived-quality win for a read-aloud app.
- **Sleep timer** — stop after N minutes / end of chapter (pairs naturally with M3 background playback).
- **Export audiobook** — once "make full audiobook" exists, allow exporting the rendered audio as a single `.m4b`/`.opus` file to share or sideload.
- **Bookmarks & notes** — mark positions, jump back, optional text notes.
- **Reading/listening stats** — time listened, books finished, progress %.
- **More input formats** — EPUB and plain-text in addition to PDF.
- **In-document search** — find text and start narration from a hit.
- **Accessibility** — TalkBack labels audit, dynamic font scaling, high-contrast theme.
- **Android Auto / CarPlay** — natural extension of the M3 MediaSession work for hands-free listening.
- **Resume after reboot / app kill** — restore the last position and (optionally) re-arm the media notification.
- **Offline-friendly crash reporting** — capture and queue crash/diagnostic info locally, no network dependency.
- **Onboarding & empty-state polish** — first-run explainer for tap-to-listen and the offline model download.

---

*Add notes / re-prioritize freely. Items 2 and 3 are gated on confirming Supertonic's voice-conditioning and provider support.*
