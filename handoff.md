# PDF Read-Aloud — Engineering Handoff

Living continuity doc for the project. Source of truth for state, native
constraints, build recipes, and what's left. Update it as things change.

- **App:** PDF Read-Aloud (`pdf-read-aloud`) — Expo / React Native, Android.
- **Version:** 1.0.0 (`android.versionCode` 1).
- **What it does:** Import a PDF → headless PDF.js text extraction → on-device
  neural TTS (Supertonic via ONNX Runtime) → paginated reader with read-aloud,
  full-audiobook prerender, background playback, and lock-screen media controls.
- **Last updated:** 2026-06-07.

---

## Critical native constraints (must persist)

These are easy to lose on a dependency bump or `expo prebuild --clean`. All are
re-applied automatically, but verify after any upgrade.

1. **New Architecture is ON** (`app.json` → `newArchEnabled: true`). The old
   `withOldArchitecture` plugin has been removed.
2. **ONNX Runtime post-install patches** (`scripts/patch-onnxruntime.js`, run
   from `package.json` `postinstall`; idempotent, self-heals, degrades to a
   warning if upstream changes):
   - **Gradle 9 compat** — ORT 1.24.3's `android/build.gradle` uses
     `VersionNumber`, removed in Gradle 9 (RN 0.85 ships Gradle 9.3.1). Patched
     to a string comparison.
   - **16 KB ELF alignment** — injects
     `-Wl,-z,max-page-size=16384,-z,common-page-size=16384` into the module's
     `CMakeLists.txt`, placed **after** `add_library()` (before
     `target_link_libraries`) so the target exists. `libonnxruntimejsi.so` is the
     only `.so` we compile from source; NDK r27 still defaults to 4 KB, which
     fails the Android 16 / Play 16 KB page-size requirement.
3. **Release signing plugin** (`plugins/withReleaseSigning.js`) — re-wires a
   `release` signingConfig into `app/build.gradle` on every prebuild (CNG
   regenerates that file). Keystore + passwords are read from Gradle properties
   (`PDFREADALOUD_RELEASE_*` in `~/.gradle/gradle.properties`), never committed.
   Falls back to the debug key when those props are absent.
   - Keystore (`*.keystore`/`*.jks`) is gitignored.
   - NDK in use: `27.1.12297006`.

---

## Build & run recipes

```bash
# Clean native regen (after dep/plugin/native changes)
npx expo prebuild --platform android --clean

# Signed release build + install to a connected device
npx expo run:android --variant release
# or incremental APK only (no install):
cd android && ./gradlew :app:assembleRelease
# APK output: android/app/build/outputs/apk/release/app-release.apk

# Verify signature
<sdk>/build-tools/<ver>/apksigner verify -v app-release.apk

# Verify 16 KB alignment (all arm64 LOAD segments must be 0x4000 / 0x10000)
llvm-readelf -l <lib>.so | grep LOAD   # check libonnxruntimejsi.so

# Typecheck (run before every commit)
npx tsc --noEmit
```

Notes: a clean all-ABI release build takes ~25–30 min (native ONNX compile for
4 ABIs). Incremental rebuilds are ~2–3 min. Node ≥ 20.19.4 is requested by Expo
(currently 20.17.0 — warning only, builds fine).

---

## What's done

- **Engine:** headless PDF.js extraction; Supertonic 2/3 builds via ONNX RT;
  4-stage TTS pipeline; model downloader with per-build/voice asset lists.
- **Reader/UI:** virtualized paginated reader, instant navigation, licenses
  screen, voice-model screen.
- **Playback (global):** `PlaybackProvider` lifts playback above the reader so
  audio survives navigation; global `MiniPlayer`; cache-first playback (no ONNX
  cold-load on cached books); speed decoupled from the cache (live playback
  rate); persistent full-audiobook progress + circular Library progress; dynamic
  FAB position.
- **M3 — background audio + lock-screen MediaSession:** verified on device
  (Samsung S26 Ultra / SM-S948B, Android 16). Play/pause, seek ±, title + album
  text all work; backgrounding keeps audio + notification alive. POST_NOTIFICATIONS
  permission requested at runtime (Android 13+).
- **M4 — release readiness:** signed release APK built & installed; 16 KB
  alignment fix landed and verified (all 20 arm64 `.so` pass,
  `libonnxruntimejsi.so` LOAD align = `0x4000`).
- **Model download progress fix:** progress is now byte-weighted against a fixed
  total in the downloader (`overall` field), so the bar fills once instead of
  once per file.

---

## Known issues / bugs (open)

1. **"Make full audiobook" stuck on "Preparing pages…"** — prerender can hang at
   the page-preparation stage; needs investigation in the Prerender flow.
2. **MiniPlayer gating is wrong** — the MiniPlayer appears based on whether text
   is *selected*, not whether audio is actually playing/loaded. It shows with no
   audio, and can **overlap/block the "Make full audiobook" button** on the
   Prerender screen. Gate the MiniPlayer on real playback state instead.
3. **10-second rewind is clip-bounded** — seeking back jumps only to the start of
   the *current* clip rather than a true −10 s that can cross into the previous
   clip/sentence. Needs cross-clip seek math.
4. **Foreground notification can't be dismissed / no Stop** — while the app is
   backgrounded and playing, the media notification can't be swiped away and has
   only play/pause (no Stop). Lock-screen also lacks an explicit Stop (acceptable
   — user can swipe to dismiss there).

---

## Next steps

- **#8 — Airplane-mode offline verification:** with the signed build, toggle
  airplane mode and confirm import → extract → synthesize → full-audiobook
  render → playback all work with zero network.
- Fix the four open issues above (prerender hang + MiniPlayer gating are the
  highest-impact / most visible).
- Bump Node to ≥ 20.19.4 to clear the Expo warning.
- See `future-work.md` for the longer backlog.
