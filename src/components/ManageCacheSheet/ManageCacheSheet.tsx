import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import {
  clearDocumentCache,
  clearProfileCache,
  findModel,
  languageLabel,
  listCachedProfiles,
  NARRATION_TONE_LABELS,
} from '../../supertonic';
import type { CachedProfile } from '../../supertonic';
import { usePlaybackContext } from '../../playback';
import { useDocumentsStore } from '../../stores';
import { ty, TYPE, useTheme } from '../../theme';
import { Button } from '../Button';
import { IconButton } from '../IconButton';
import { Sheet } from '../Sheet';
import { voiceLabel } from '../VoicePicker';
import { makeStyles } from './ManageCacheSheet.styles';

export type ManageCacheSheetProps = {
  open: boolean;
  onClose: () => void;
  docHash: string | null;
  title?: string;
};

function formatSize(bytes: number): string {
  if (bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function profileLabel(cp: CachedProfile): { title: string; sub: string } {
  if (!cp.meta) return { title: 'Unknown voice', sub: 'Cached before voice labels' };
  const sub = [languageLabel(cp.meta.lang), findModel(cp.meta.modelId)?.label, NARRATION_TONE_LABELS[cp.meta.tone]?.title]
    .filter(Boolean)
    .join(' · ');
  return { title: voiceLabel(cp.meta.voiceId), sub };
}

// Per-voice cache manager: a doc can hold audio for several voices/profiles; list
// them with size + clip count and remove one or all. Deleting the playing voice
// stops playback, and dropping an audiobook's profile forgets that render.
export function ManageCacheSheet({ open, onClose, docHash, title }: ManageCacheSheetProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const { playback, activeDoc } = usePlaybackContext();
  const audiobook = useDocumentsStore((s) => s.audiobook);
  const clearAudiobook = useDocumentsStore((s) => s.clearAudiobook);

  const [profiles, setProfiles] = useState<CachedProfile[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = () => setProfiles(docHash ? listCachedProfiles(docHash) : []);

  useEffect(() => {
    if (open) {
      refresh();
      setConfirmClear(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, docHash]);

  const isActive = !!docHash && activeDoc?.doc.docHash === docHash;

  const deleteProfile = (cp: CachedProfile) => {
    if (!docHash) return;
    if (isActive) playback.stop(); // this voice may be playing — stop before its files vanish
    clearProfileCache(docHash, cp.hash);
    // Forget an audiobook rendered with this exact profile so the reader doesn't
    // treat the deleted render as available.
    if (audiobook[docHash]?.profileHash === cp.hash) clearAudiobook(docHash);
    refresh();
  };

  const clearAll = () => {
    if (!docHash) return;
    if (isActive) playback.stop();
    clearDocumentCache(docHash);
    clearAudiobook(docHash);
    onClose();
  };

  const totalBytes = profiles.reduce((sum, cp) => sum + cp.bytes, 0);

  return (
    <Sheet open={open} onClose={onClose} title={title ?? 'Manage cached audio'} heightRatio={0.6}>
      <View style={styles.container}>
        {profiles.length === 0 ? (
          <View style={styles.empty}>
            <Text style={ty(TYPE.body, p.textMuted)}>No cached audio for this document.</Text>
          </View>
        ) : (
          <>
            <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 8 }}>
              <View style={styles.card}>
                {profiles.map((cp, i) => {
                  const { title: vTitle, sub } = profileLabel(cp);
                  const isRenderProfile = !!docHash && audiobook[docHash]?.profileHash === cp.hash;
                  return (
                    <View
                      key={cp.hash}
                      style={[styles.row, { borderBottomWidth: i === profiles.length - 1 ? 0 : 1 }]}
                    >
                      <View style={styles.rowBody}>
                        <Text style={ty(TYPE.bodyMedium, p.text)} numberOfLines={1}>
                          {vTitle}
                          {isRenderProfile ? '  ·  Audiobook' : ''}
                        </Text>
                        <Text style={ty(TYPE.bodySmall, p.textMuted)} numberOfLines={1}>
                          {[sub, `${cp.count} clip${cp.count === 1 ? '' : 's'}`, formatSize(cp.bytes)]
                            .filter(Boolean)
                            .join('  ·  ')}
                        </Text>
                      </View>
                      <IconButton
                        icon="trash"
                        variant="tonal"
                        onPress={() => deleteProfile(cp)}
                        accessibilityLabel={`Remove ${vTitle} cache`}
                      />
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.footer}>
              <Button
                label={confirmClear ? 'Tap again to clear everything' : `Clear all · ${formatSize(totalBytes)}`}
                icon="trash"
                variant="danger"
                full
                onPress={() => {
                  if (confirmClear) clearAll();
                  else setConfirmClear(true);
                }}
              />
              <Text style={[ty(TYPE.caption, p.textDim), styles.note]}>
                Cleared audio is re-generated on demand the next time you play.
              </Text>
            </View>
          </>
        )}
      </View>
    </Sheet>
  );
}
