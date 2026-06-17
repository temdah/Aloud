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
- **Keep the engine resident** *(largely done via the global provider)* — `usePlayback` lives in `PlaybackProvider`, mounted once at the App root and never unmounted, so its `engineRef` (loaded `TextToSpeech` + `VoiceStyle`) persists for the whole session; re-entering the reader reuses it and pays no cold-load. Remaining gap: the engine reloads when `modelId`/`voiceId` change (correct) but is never proactively released on memory pressure — add a release-on-background / low-memory hook if RAM becomes an issue. A cross-document module-level singleton is unnecessary now that the provider is global.
- **Smarter prefetch** — `PREFETCH_AHEAD` is a fixed 4 in `usePlayback`. Make it adaptive: prefetch further when synthesis is faster than realtime, throttle when the device is struggling, and prioritize the *next* chunk over deep look-ahead.
- **Compress cached audio** *(in progress — `modules/aac-codec`, MediaCodec AAC)* — the cache stores raw WAV (`wavEncoder` in `src/supertonic/synthesis/wavEncoder.ts`), which is large (~172 KB/s of audio) and slow to write. Encoding to AAC (`.m4a`) cuts cache size ~10× and speeds up file IO. **Codec note:** the model outputs 44.1 kHz. Opus can't encode 44.1 kHz without a resampler, and bundling libvorbis/libopus means vendoring + compiling C — so instead we use **Android's built-in MediaCodec AAC encoder** (no bundled codec library, native 44.1 kHz, no resampler). There is no pure-JS AAC encoder; encoding lives in a small Kotlin Expo module wrapping `MediaCodec` + `MediaMuxer`, which forces a native rebuild (`expo prebuild`). **Concrete path:** (a) `aac-codec` module exposes `encodeWavsToM4a(srcWavPaths, dst, bitrate)`; (b) swap `wavEncoder` output for it in `narrator`/`audioCache`, keeping WAV as a fallback if the module is absent; (c) Media3 plays `.m4a` via `player.replace`; (d) bump `SYNTH_VERSION` so old WAV caches are re-rendered. **Touches:** `modules/aac-codec`, `narration/{narrator,audioCache}.ts`, manifest cache-version.
- **Async cache writes** — ensure WAV/AAC writes don't block the synthesis loop; write in the background and update the manifest atomically.

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

- **Per-word highlight (karaoke)** *(deferred — needs forced alignment)* — the "Map B" word-level timing; highlight the spoken word, not just the active chunk. Biggest perceived-quality win for a read-aloud app. **Why deferred:** Supertonic synthesizes a chunk to a single audio clip and does **not** emit per-word/per-phoneme timestamps, so we have no time→word mapping. Getting one requires a *forced alignment* pass between the synthesized audio and its text. **Concrete options when picked up:** (1) check whether the Supertonic ONNX graph can expose the model's internal duration/attention alignment (TTS models know phoneme durations) — cheapest if available, fully offline; (2) failing that, run a separate forced aligner (e.g. an on-device CTC/MFA-style aligner) over each clip — accurate but heavy and likely a native dep; (3) a crude proportional fallback — distribute clip duration across words by character/syllable weight — no new deps, approximate but cheap. Start by confirming (1). **Touches:** `src/supertonic/synthesis/*` (surface timings), the `ChunkTiming`/`WordTiming` types already in `src/types/document.ts`, highlight rendering in the reader.
- **Sleep timer** — stop after N minutes / end of chapter (pairs naturally with M3 background playback). *(Basic minutes-based timer implemented; "end of chapter" still open.)*
- **Export audiobook** — once "make full audiobook" exists, allow exporting the rendered audio as a single `.m4b`/`.m4a` file to share or sideload.
- **Bookmarks & notes** — mark positions, jump back, optional text notes.
- **Reading/listening stats** — time listened, books finished, progress %.
- **More input formats** — EPUB still to do. *(PDF, Markdown `.md`, and Word `.docx` are supported — see `src/extractors/`. Plain-text `.txt` is partially covered: `.md` without markdown syntax already reads as prose, so a dedicated `.txt` kind is low effort.)*
- **In-document search** — find text and start narration from a hit.
- **Accessibility** — TalkBack labels audit, dynamic font scaling, high-contrast theme.
- **Android Auto / CarPlay** — natural extension of the M3 MediaSession work for hands-free listening.
- **Resume after reboot / app kill** — restore the last position and (optionally) re-arm the media notification.
- **Offline-friendly crash reporting** — capture and queue crash/diagnostic info locally, no network dependency.
- **Onboarding & empty-state polish** — first-run explainer for tap-to-listen and the offline model download.

---

## 5. Lock-screen seek & notification control fidelity

**Goal:** make the OS media controls behave like a normal audiobook player.

**Background:** playback is a sequence of *separate per-chunk audio files* loaded via
`player.replace()` in `usePlayback.ts`, and expo-audio handles the lock-screen
transport **natively** (no JS hook for the seek buttons).

**Approach**
- **Cross-clip −10 s / +10 s** — today the lock-screen seek clamps to the current
  clip (`[0, clipDuration]`), so −10 s lands at the start of the current clip
  instead of going back into the previous sentence. Fixing this needs either a
  continuous-timeline playback model (one stream instead of clip-by-clip files)
  or intercepting the OS seek to manually load the previous clip at an offset.
  Cheaper interim: map the seek-back button to `previous()` (skip a chunk) when
  near a clip start — confirm expo-audio exposes the event first.
- **OS Stop action** — expo-audio's lock-screen options only expose play/pause +
  seek; there is no Stop button, and an actively-playing media notification can't
  be swipe-dismissed (Android foreground-service rule; it becomes dismissible on
  pause). A true OS Stop button would require swapping expo-audio for
  `react-native-track-player`. Evaluate that trade-off if richer media controls
  (queue, Android Auto, Stop) become a priority — it also unlocks item 4's
  Android Auto / CarPlay idea.

**Touches:** `src/hooks/usePlayback.ts` (`LOCK_OPTIONS`, `playChunkObject`,
seek/next/previous), possibly a playback-engine rewrite or native-dep swap.

---

*Add notes / re-prioritize freely. Items 2 and 3 are gated on confirming Supertonic's voice-conditioning and provider support.*
