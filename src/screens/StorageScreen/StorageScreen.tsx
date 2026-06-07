import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppBar, Icon, ListItem, ManageCacheSheet, SettingsSection } from '../../components';
import { useDocumentsStore } from '../../stores';
import { documentCacheStats } from '../../supertonic';
import { ty, TYPE, useTheme } from '../../theme';
import type { ImportedDocument } from '../../types';
import type { AppNavigation } from '../../navigation/navigationTypes';
import { makeStyles } from './StorageScreen.styles';

function formatSize(bytes: number): string {
  if (bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

// Global "Cached audio" screen: lists every document that currently has cached
// TTS on disk, each opening the per-voice ManageCacheSheet. Reached from
// Settings → Models & storage → Cached audio.
export default function StorageScreen() {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const navigation = useNavigation<AppNavigation>();
  const documents = useDocumentsStore((s) => s.documents);
  const [manageDoc, setManageDoc] = useState<ImportedDocument | null>(null);

  // Recompute on every render (cheap dir scans); a deletion inside the sheet
  // re-renders this screen via the documents/audiobook store, refreshing sizes.
  const entries = useMemo(
    () =>
      documents
        .map((doc) => ({ doc, stats: documentCacheStats(doc.docHash) }))
        .filter((e) => e.stats.bytes > 0)
        .sort((a, b) => b.stats.bytes - a.stats.bytes),
    [documents, manageDoc],
  );

  const totalBytes = entries.reduce((sum, e) => sum + e.stats.bytes, 0);

  return (
    <View style={styles.screen}>
      <AppBar onBack={() => navigation.goBack()} title="Cached audio" />
      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="trash" size={40} color={p.textDim} />
          <Text style={[ty(TYPE.body, p.textMuted), styles.emptyText]}>
            No cached audio yet. Audio is cached as you listen, and when you make a full audiobook.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[ty(TYPE.caption, p.textDim), styles.total]}>
            {entries.length} document{entries.length === 1 ? '' : 's'} · {formatSize(totalBytes)} total
          </Text>
          <SettingsSection title="Documents">
            <View style={styles.card}>
              {entries.map((e, i) => (
                <ListItem
                  key={e.doc.docHash}
                  divider={i !== entries.length - 1}
                  leading={<View style={styles.leadingMuted}><Icon name="book" size={16} color={p.textMuted} /></View>}
                  title={e.doc.title}
                  subtitle={`${e.stats.count} clip${e.stats.count === 1 ? '' : 's'} · ${formatSize(e.stats.bytes)}`}
                  trailing={<Icon name="chevR" size={18} color={p.textDim} />}
                  onPress={() => setManageDoc(e.doc)}
                />
              ))}
            </View>
          </SettingsSection>
        </ScrollView>
      )}

      <ManageCacheSheet
        open={!!manageDoc}
        onClose={() => setManageDoc(null)}
        docHash={manageDoc?.docHash ?? null}
        title={manageDoc?.title}
      />
    </View>
  );
}
