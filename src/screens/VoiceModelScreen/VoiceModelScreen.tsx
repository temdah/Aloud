import { useNavigation } from '@react-navigation/native';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppBar, ModelCard } from '../../components';
import { useSettingsStore } from '../../stores';
import { MODELS } from '../../supertonic';
import { ty, TYPE, useTheme } from '../../theme';
import type { AppNavigation } from '../../navigation';
import { makeStyles } from './VoiceModelScreen.styles';

// Choose + download a voice engine. Both builds can be installed at once; the
// active one (set via "Use this model") is what reading uses.
export default function VoiceModelScreen() {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const navigation = useNavigation<AppNavigation>();
  const modelId = useSettingsStore((s) => s.modelId);
  const setModelId = useSettingsStore((s) => s.setModelId);
  const voiceId = useSettingsStore((s) => s.voiceId);

  return (
    <View style={styles.screen}>
      <AppBar onBack={() => navigation.goBack()} title="Voice model" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[ty(TYPE.body, p.textMuted), styles.intro]}>
          Pick a voice engine to download. You can install both and switch anytime — reading uses the one marked “In use”.
        </Text>
        {MODELS.map((m) => (
          <ModelCard
            key={m.id}
            model={m}
            voiceId={voiceId}
            active={modelId === m.id}
            onUse={() => setModelId(m.id)}
            onDeleted={() => {
              if (modelId === m.id) setModelId(null);
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}
