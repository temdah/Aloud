# PDF Read-Aloud

An offline Android app that reads PDFs aloud with a natural, on-device AI voice.
Import a PDF, tap anywhere in the text, and it reads from there — fully offline,
with the sentence being spoken highlighted as it plays. Audio is cached per
document, so reopening never re-synthesizes.

## How it works

- **Platform:** React Native (Expo SDK 56, TypeScript), Android, portrait.
- **Voice:** on-device text-to-speech using **Supertonic** (ONNX) via
  `onnxruntime-react-native` — nothing is sent to the cloud, no audio leaves the
  device. The voice model (~263 MB) is downloaded once on first launch and then
  works fully offline.
- **PDF + text:** rendered in a WebView with PDF.js, which also provides the text
  to read and the tap-to-start positions.
- **Other pieces:** `expo-audio` (playback), `expo-file-system` (model + audio
  cache), `react-native-svg` (icons), bundled fonts (Newsreader, DM Sans,
  JetBrains Mono).
- **UI:** a centralised design-token theme (light/dark), a shared component
  library, and screens for the Library, Reader, Settings, and first-run model
  download.

Source lives under `src/` (`components/`, `screens/`, `navigation/`, `theme/`,
`types/`, and `supertonic/` — the TTS engine). See `coderules.md` for the code
conventions.

## How to launch

Requirements: Node.js, the Android SDK + `adb`, and an Android phone with USB
debugging enabled.

```bash
npm install
```

**Dev run (build, install, and start — easiest):**
```bash
npx expo run:android
```

**Fast re-runs (app already installed, no native changes):**
```bash
adb reverse tcp:8081 tcp:8081
npx expo start --dev-client --host localhost
```
then press `a` to open it on the phone. (`--host localhost` + `adb reverse` routes
through the USB/wireless bridge and avoids the firewall blocking Wi-Fi port 8081.)

**Without a cable:** pair the phone once via Settings → Developer options →
**Wireless debugging** (`adb pair …` then `adb connect …`), then use the same
commands above.

**Standalone (no computer, fully offline):** build a release APK with the JS
bundled in:
```bash
npx expo run:android --variant release
```
Output: `android/app/build/outputs/apk/release/app-release.apk` — install it on
any phone via "allow unknown sources" and launch from the home screen.

> First launch needs internet once to download the voice model (~263 MB);
> everything after that is offline.
