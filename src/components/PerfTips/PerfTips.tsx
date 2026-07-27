import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { elevation, ty, TYPE, useTheme } from '../../theme';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import { Sheet } from '../Sheet';
import { makeStyles } from './PerfTips.styles';

export type PerfTipsProps = {
  visible: boolean;
  onDismiss: () => void; // banner X — hide for now (starts a cooldown)
  onSuppress: () => void; // "don't show again"
  onMakeAudiobook: () => void;
  onChangeVoice: () => void;
  lighterVoiceHint?: string; // set when a lighter model is worth suggesting
};

// Shown when playback repeatedly stalls on a slow device: a dismissible banner
// that opens a sheet of ways to get smoother audio.
export function PerfTips({ visible, onDismiss, onSuppress, onMakeAudiobook, onChangeVoice, lighterVoiceHint }: PerfTipsProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!visible && !sheetOpen) return null;

  return (
    <>
      {visible ? (
        <View style={[styles.banner, elevation(1)]}>
          <Icon name="wave" size={18} color={p.primary} />
          <View style={styles.bannerBody}>
            <Text style={ty(TYPE.bodyMedium, p.text)}>Audio keeps pausing?</Text>
            <Text style={ty(TYPE.bodySmall, p.textMuted)}>Your device may be slow for this voice.</Text>
          </View>
          <Button label="See tips" size="sm" variant="tonal" onPress={() => setSheetOpen(true)} />
          <IconButton icon="close" variant="ghost" onPress={onDismiss} accessibilityLabel="Dismiss" />
        </View>
      ) : null}

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Smoother playback" heightRatio={0.56}>
        <View style={styles.tips}>
          <View style={styles.tip}>
            <View style={styles.tipBody}>
              <Text style={ty(TYPE.bodyMedium, p.text)}>Make a full audiobook</Text>
              <Text style={ty(TYPE.bodySmall, p.textMuted)}>Generate the whole document up front so playback never waits.</Text>
            </View>
            <Button label="Prepare" size="sm" variant="filled" onPress={() => { setSheetOpen(false); onMakeAudiobook(); }} />
          </View>

          {lighterVoiceHint ? (
            <View style={styles.tip}>
              <View style={styles.tipBody}>
                <Text style={ty(TYPE.bodyMedium, p.text)}>{lighterVoiceHint}</Text>
                <Text style={ty(TYPE.bodySmall, p.textMuted)}>A lighter voice model synthesizes faster on slower devices.</Text>
              </View>
              <Button label="Change" size="sm" variant="tonal" onPress={() => { setSheetOpen(false); onChangeVoice(); }} />
            </View>
          ) : null}

          <View style={styles.note}>
            <Text style={ty(TYPE.bodySmall, p.textMuted)}>
              You can also lower “Speed vs. quality” in Settings. Battery saver or a hot device slows synthesis too.
            </Text>
          </View>

          <Button label="Don’t show these tips again" variant="ghost" full onPress={() => { setSheetOpen(false); onSuppress(); }} />
        </View>
      </Sheet>
    </>
  );
}
