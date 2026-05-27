import { useMemo } from 'react';
import { Alert, Text, View } from 'react-native';
import { useModelDownload } from '../../hooks';
import type { ModelInfo } from '../../supertonic';
import { ty, TYPE, useTheme } from '../../theme';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { ProgressBar } from '../ProgressBar';
import { makeStyles } from './ModelCard.styles';

export type ModelCardProps = {
  model: ModelInfo;
  voiceId: string;
  active: boolean;
  /** Set this build as the one reading uses (only offered once downloaded). */
  onUse: () => void;
  /** Called after this build's files are deleted (e.g. to clear the active selection). */
  onDeleted?: () => void;
};

// One selectable Supertonic build: its overview/size, its own download state
// (via useModelDownload), and Use / In-use / Delete controls. Both builds can
// be installed at once; reading uses whichever is active.
export function ModelCard({ model, voiceId, active, onUse, onDeleted }: ModelCardProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const { status, progress, error, start, remove } = useModelDownload(model.id, voiceId);

  const confirmDelete = () => {
    Alert.alert(`Delete ${model.label}?`, `Frees about ${model.approxMb} MB. You can re-download it anytime.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          remove();
          onDeleted?.();
        },
      },
    ]);
  };

  return (
    <View style={[styles.card, active ? styles.cardActive : null]}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={ty(TYPE.title, p.text)}>{model.label}</Text>
          <Text style={[ty(TYPE.bodySmall, p.primary), styles.tagline]}>{model.tagline}</Text>
        </View>
        {active && status === 'ready' ? (
          <View style={styles.inUseBadge}>
            <Icon name="check" size={14} color={p.success} />
            <Text style={ty(TYPE.label, p.success)}>In use</Text>
          </View>
        ) : (
          <Text style={ty(TYPE.mono, p.textMuted)}>~{model.approxMb} MB</Text>
        )}
      </View>

      <Text style={[ty(TYPE.bodySmall, p.textMuted), styles.overview]}>{model.overview}</Text>

      <View style={styles.metaRow}>
        <Icon name="voice" size={13} color={p.textDim} />
        <Text style={ty(TYPE.caption, p.textDim)}>{model.languages}</Text>
      </View>

      <View style={styles.footer}>
        {status === 'downloading' ? (
          <>
            <View style={styles.progressRow}>
              <Text style={ty(TYPE.label, p.text)}>Downloading…</Text>
              <Text style={ty(TYPE.mono, p.textMuted)}>{Math.round(progress * 100)}%</Text>
            </View>
            <ProgressBar value={progress} height={6} />
          </>
        ) : status === 'error' ? (
          <>
            <Text style={[ty(TYPE.caption, p.danger), styles.errorText]}>{error}</Text>
            <Button label="Try again" icon="download" variant="tonal" full onPress={start} />
          </>
        ) : status === 'ready' ? (
          <>
            {active ? null : <Button label="Use this model" variant="filled" full onPress={onUse} />}
            <View style={active ? undefined : styles.deleteWrap}>
              <Button label="Delete download" icon="trash" variant="ghost" full onPress={confirmDelete} />
            </View>
          </>
        ) : (
          <Button label={`Download · ~${model.approxMb} MB`} icon="download" variant="tonal" full onPress={start} />
        )}
      </View>
    </View>
  );
}
