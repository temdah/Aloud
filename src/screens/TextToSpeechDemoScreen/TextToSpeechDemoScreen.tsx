import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { useMemo, useRef, useState } from 'react';
import { Button, ScrollView, Text, View } from 'react-native';
import {
  DEFAULT_VOICE,
  encodeWav,
  loadTextToSpeech,
  loadVoiceStyle,
  TextToSpeech,
  VoiceStyle,
} from '../../supertonic';
import { useSettingsStore } from '../../stores';
import { useTheme } from '../../theme';
import { makeStyles } from './TextToSpeechDemoScreen.styles';

const SAMPLE_SENTENCE =
  'The quick brown fox jumps over the lazy dog, and then it reads a book aloud.';
const SAMPLE_LANGUAGE = 'en';
const OUTPUT_FILE = 'tts_output.wav';

// Milestone-0 diagnostics: synthesizes one sentence on-device, plays it, and
// reports the real-time factor. The model download lives in Settings → voice
// model; this screen assumes it's already installed.
export default function TextToSpeechDemoScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const modelId = useSettingsStore((s) => s.modelId);
  const [log, setLog] = useState('On-device Supertonic TTS demo.\n');
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState(8);
  const ttsRef = useRef<TextToSpeech | null>(null);
  const voiceRef = useRef<VoiceStyle | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);

  const append = (line: string) => {
    console.log('[tts-demo]', line);
    setLog((prev) => prev + line + '\n');
  };

  const ensureLoaded = async () => {
    if (ttsRef.current && voiceRef.current) return;
    if (!modelId) throw new Error('No voice model selected — pick one in Settings → Voice model.');
    append(`Loading ONNX sessions (${modelId})...`);
    const start = Date.now();
    ttsRef.current = await loadTextToSpeech(modelId);
    voiceRef.current = await loadVoiceStyle(modelId, DEFAULT_VOICE);
    append(`Sessions loaded in ${seconds(Date.now() - start)} s (sampleRate=${ttsRef.current.sampleRate}).`);
  };

  const synthesizeAndPlay = async () => {
    setBusy(true);
    try {
      await ensureLoaded();
      const tts = ttsRef.current!;
      const voice = voiceRef.current!;

      append(`Synthesizing (steps=${steps})...`);
      const start = Date.now();
      const { waveform, durationsSec } = await tts.synthesize(
        SAMPLE_SENTENCE,
        SAMPLE_LANGUAGE,
        voice,
        steps,
        1.05,
        (current, total) => {
          if (current === 1 || current === total) append(`  step ${current}/${total}`);
        },
      );
      const synthMs = Date.now() - start;

      const audioSec = waveform.length / tts.sampleRate;
      const rtf = synthMs / 1000 / audioSec;
      append(`Audio: ${audioSec.toFixed(2)} s (${waveform.length} samples).`);
      append(`Synth time: ${seconds(synthMs)} s.`);
      append(`>>> RTF = ${rtf.toFixed(3)} (predicted duration ${durationsSec[0].toFixed(2)} s)`);

      const output = new File(Paths.document, OUTPUT_FILE);
      if (output.exists) output.delete();
      output.create();
      output.write(encodeWav(waveform, tts.sampleRate));

      await setAudioModeAsync({ playsInSilentMode: true });
      playerRef.current?.remove?.();
      playerRef.current = createAudioPlayer(output.uri);
      playerRef.current.play();
      append('Playing.');
    } catch (error) {
      append('SYNTH ERROR: ' + describe(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Aloud — TTS demo</Text>
      <Text style={styles.hint}>Install the voice in Settings → voice model first.</Text>
      <View style={styles.row}>
        <Button title="- steps" onPress={() => setSteps((s) => Math.max(1, s - 1))} disabled={busy} />
        <Text style={styles.steps}>steps: {steps}</Text>
        <Button title="+ steps" onPress={() => setSteps((s) => s + 1)} disabled={busy} />
      </View>
      <View style={styles.row}>
        <Button title="Synthesize + play" onPress={synthesizeAndPlay} disabled={busy} />
      </View>
      <ScrollView style={styles.logBox}>
        <Text style={styles.logText}>{log}</Text>
      </ScrollView>
    </View>
  );
}

const seconds = (ms: number) => (ms / 1000).toFixed(2);
const describe = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
