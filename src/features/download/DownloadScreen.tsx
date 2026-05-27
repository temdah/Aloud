import { Text, View } from 'react-native';
import { Icon, ProgressBar } from '../../components';
import { DownloadHero } from './DownloadHero';
import { RADIUS, ty, TYPE, useTheme } from '../../theme';

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
  const showOverallBytes = downloadedLabel != null && totalLabel != null;

  return (
    <View style={{ flex: 1, backgroundColor: p.background, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 24 }}>
      <Text style={ty(TYPE.overline, p.primary)}>FIRST RUN</Text>
      <Text style={[ty(TYPE.titleLarge, p.text), { marginTop: 8 }]}>Setting up the voice</Text>
      <Text style={[ty(TYPE.body, p.textMuted), { marginTop: 6 }]}>
        Downloading the on-device voice model. This is a one-time setup — afterwards, reading works fully offline.
      </Text>

      <DownloadHero progress={progress} />

      <View style={{ marginTop: 20, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <Text style={ty(TYPE.label, p.text)}>Overall</Text>
          {showOverallBytes ? <Text style={ty(TYPE.mono, p.textMuted)}>{downloadedLabel} / {totalLabel}</Text> : null}
        </View>
        <ProgressBar value={progress} height={8} />
      </View>

      {files.length > 0 ? (
        <View style={{ backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: RADIUS.md, paddingVertical: 4 }}>
          {files.map((f, i) => (
            <View key={f.name} style={{ paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: p.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={ty(TYPE.mono, p.text)}>{f.name}</Text>
                {f.fraction >= 1 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
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

      <View style={{ flex: 1 }} />
      <Text style={[ty(TYPE.caption, p.textDim), { textAlign: 'center', marginTop: 16 }]}>
        You can keep the app open or lock the screen — it&apos;ll keep going.
      </Text>
    </View>
  );
}
