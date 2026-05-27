import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { DownloadHero, Icon, ProgressBar } from '../../components';
import { ty, TYPE, useTheme } from '../../theme';
import { makeStyles } from './DownloadScreen.styles';

export type DownloadFileProgress = { name: string; fraction: number };

type DownloadScreenProps = {
  progress?: number; // 0..1 overall
  downloadedLabel?: string;
  totalLabel?: string;
  files?: DownloadFileProgress[];
};

// First-run model download. All progress is supplied by the caller (driven by
// ensureModelsDownloaded in src/supertonic); this screen only renders it.
export default function DownloadScreen({ progress = 0, downloadedLabel, totalLabel, files = [] }: DownloadScreenProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const showOverallBytes = downloadedLabel != null && totalLabel != null;

  return (
    <View style={styles.screen}>
      <Text style={ty(TYPE.overline, p.primary)}>FIRST RUN</Text>
      <Text style={[ty(TYPE.titleLarge, p.text), styles.heading]}>Setting up the voice</Text>
      <Text style={[ty(TYPE.body, p.textMuted), styles.intro]}>
        Downloading the on-device voice model. This is a one-time setup — afterwards, reading works fully offline.
      </Text>

      <DownloadHero progress={progress} />

      <View style={styles.overallSection}>
        <View style={styles.overallRow}>
          <Text style={ty(TYPE.label, p.text)}>Overall</Text>
          {showOverallBytes ? <Text style={ty(TYPE.mono, p.textMuted)}>{downloadedLabel} / {totalLabel}</Text> : null}
        </View>
        <ProgressBar value={progress} height={8} />
      </View>

      {files.length > 0 ? (
        <View style={styles.fileCard}>
          {files.map((f, i) => (
            <View key={f.name} style={{ paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: p.border }}>
              <View style={styles.fileRowHeader}>
                <Text style={ty(TYPE.mono, p.text)}>{f.name}</Text>
                {f.fraction >= 1 ? (
                  <View style={styles.doneBadge}>
                    <Icon name="check" size={12} color={p.success} />
                    <Text style={ty(TYPE.mono, p.success)}>done</Text>
                  </View>
                ) : (
                  <Text style={ty(TYPE.mono, p.textMuted)}>{Math.round(f.fraction * 100)}%</Text>
                )}
              </View>
              <ProgressBar value={f.fraction} height={3} color={f.fraction >= 1 ? p.success : p.primary} />
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.spacer} />
      <Text style={[ty(TYPE.caption, p.textDim), styles.footnote]}>
        You can keep the app open or lock the screen — it&apos;ll keep going.
      </Text>
    </View>
  );
}
