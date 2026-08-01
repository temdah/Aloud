import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { encodeWav, ensureModelsDownloaded, getEngine, getVoice, withEngine } from '../../supertonic';
import { ty, TYPE, useTheme } from '../../theme';
import { SAMPLE_TEXT } from '../../utils';
import { Chip } from '../Chip';
import { Icon } from '../Icon';
import { Spinner } from '../Spinner';
import { VoiceSwatch } from '../VoiceSwatch';
import { VOICES } from './voiceCatalog';
import { makeStyles } from './VoicePicker.styles';

export type VoicePickerProps = {
  value: string;
  onChange: (id: string) => void;
  modelId: string | null;
  lang?: string;
};
type GenderFilter = 'all' | 'f' | 'm';

const PREVIEW_FILE = 'voice_preview.wav';
const PREVIEW_STEPS = 8; // fast enough for an instant-ish on-device preview

// Voice-picker sheet body: gender filter + selectable list with a real on-device
// preview. Selecting a voice also pre-fetches its style file so reading works
// immediately afterwards.
export function VoicePicker({ value, onChange, modelId, lang = 'en' }: VoicePickerProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const [gender, setGender] = useState<GenderFilter>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  const playerRef = useRef<AudioPlayer | null>(null);
  const tokenRef = useRef(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      tokenRef.current++;
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      try {
        playerRef.current?.remove?.();
      } catch {}
      playerRef.current = null;
    };
  }, []);

  const filtered = VOICES.filter((v) => gender === 'all' || v.gender === gender);

  const preview = async (voiceId: string) => {
    if (!modelId) return;
    if (playing === voiceId) {
      tokenRef.current++;
      try {
        playerRef.current?.pause();
      } catch {}
      setPlaying(null);
      return;
    }
    const token = ++tokenRef.current;
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    setPlaying(null);
    setBusy(voiceId);
    try {
      const tts = await getEngine(modelId); // shared resident engine
      if (token !== tokenRef.current) return;
      const voice = await getVoice(modelId, voiceId); // fetches the style file if missing
      if (token !== tokenRef.current) return;
      const { waveform } = await withEngine(modelId, (t) => t.synthesize(SAMPLE_TEXT, lang, voice, PREVIEW_STEPS, 1.05));
      if (token !== tokenRef.current) return;

      const out = new File(Paths.cache, PREVIEW_FILE);
      if (out.exists) out.delete();
      out.create();
      out.write(encodeWav(waveform, tts.sampleRate));

      await setAudioModeAsync({ playsInSilentMode: true });
      if (token !== tokenRef.current) return;
      try {
        playerRef.current?.remove?.();
      } catch {}
      playerRef.current = createAudioPlayer(out.uri);
      playerRef.current.play();
      setBusy(null);
      setPlaying(voiceId);
      // No status hook on a ref-held player, so clear "playing" on a timer.
      const audioMs = (waveform.length / tts.sampleRate) * 1000;
      stopTimerRef.current = setTimeout(() => {
        if (token === tokenRef.current) setPlaying(null);
      }, audioMs + 400);
    } catch (e) {
      console.warn('[VoicePicker] preview failed:', e);
      if (token === tokenRef.current) {
        setBusy(null);
        setPlaying(null);
      }
    }
  };

  // Commit immediately, then pre-fetch the style file so reading works right
  // away (the engine self-heals anyway; this just removes the first-play wait).
  const select = (voiceId: string) => {
    onChange(voiceId);
    if (!modelId) return;
    void ensureModelsDownloaded(modelId, voiceId).catch((e) =>
      console.warn('[VoicePicker] failed to pre-fetch voice:', e),
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <Chip label="All" selected={gender === 'all'} onPress={() => setGender('all')} />
        <Chip label="Female" selected={gender === 'f'} onPress={() => setGender('f')} />
        <Chip label="Male" selected={gender === 'm'} onPress={() => setGender('m')} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          {filtered.map((v, i) => (
          <Pressable
            key={v.id}
            onPress={() => select(v.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: value === v.id }}
            style={[
              styles.rowBase,
              {
                backgroundColor: value === v.id ? p.primarySoft : 'transparent',
                borderBottomWidth: i === filtered.length - 1 ? 0 : 1,
              },
            ]}
          >
            <VoiceSwatch idx={parseInt(v.id.slice(1), 10) - 1} gender={v.gender} />
            <View style={styles.rowBody}>
              <Text style={ty(TYPE.bodyMedium, p.text)}>{v.label}</Text>
              <Text style={ty(TYPE.bodySmall, p.textMuted)}>{v.id}</Text>
            </View>
            <Pressable
              onPress={() => void preview(v.id)}
              disabled={!modelId || (busy !== null && busy !== v.id)}
              accessibilityRole="button"
              accessibilityLabel={`Preview ${v.label}`}
              style={[styles.previewBase, { backgroundColor: playing === v.id ? p.primary : p.surfaceAlt }]}
            >
              {busy === v.id ? (
                <Spinner size={14} color={p.text} />
              ) : (
                <Icon name={playing === v.id ? 'pause' : 'play'} size={14} color={playing === v.id ? p.onPrimary : p.text} />
              )}
            </Pressable>
            {value === v.id ? <Icon name="check" size={20} color={p.primary} /> : null}
          </Pressable>
        ))}
        </View>
        <Text style={[ty(TYPE.caption, p.textDim), styles.footnote]}>
          {modelId ? 'Tap a voice to preview · runs locally, no audio leaves the device' : 'Choose a voice model first to preview voices'}
        </Text>
      </ScrollView>
    </View>
  );
}
