# Aloud

An offline Android app that reads your documents aloud with a natural, on-device
AI voice. Import a file (PDF, Markdown, or Word), tap anywhere in the text, and it
reads from there — fully offline,
with the sentence being spoken highlighted as it plays. Audio is cached per
document and narration profile, so matching audio can be reused on reopen.

## How it works

- **Platform:** React Native (Expo SDK 56, TypeScript), Android, portrait.
- **Voice:** on-device text-to-speech using **Supertonic** (ONNX) via
  `onnxruntime-react-native` — nothing is sent to the cloud, no audio leaves the
  device. The selected voice model (about 263 MB for Supertonic 2 or 398 MB for
  Supertonic 3) is downloaded during onboarding and then works fully offline.
- **PDF + text:** PDFs are extracted page-by-page in a hidden local PDF.js
  WebView. The resulting canonical text and character offsets drive a reflowed
  native reader, tap-to-start, highlighting, and resume position. Markdown and
  DOCX are extracted directly in JavaScript.
- **Other pieces:** `expo-audio` (playback), `expo-file-system` (model + audio
  cache), a small Android MediaCodec module (AAC/M4A encoding and audiobook
  concatenation), `react-native-svg` (icons), and bundled fonts (Newsreader,
  DM Sans, JetBrains Mono).
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

> Onboarding needs internet once to download the selected voice model;
> everything after that is offline.
