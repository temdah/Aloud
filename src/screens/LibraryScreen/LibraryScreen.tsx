import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { File } from 'expo-file-system';
import { ActionDialog, AppBar, BookRow, Chip, EmptyLibrary, FAB, Icon, IconButton, ManageCacheSheet, Sheet } from '../../components';
import { useImportDocument } from '../../hooks';
import { deleteExtractedText } from '../../pdf/extractedTextCache';
import { clearExtractedImages } from '../../pdf';
import { loadExtractedText } from '../../pdf';
import { usePlaybackContext } from '../../playback';
import type { ActiveDoc } from '../../playback';
import { useDocumentsStore, useSettingsStore } from '../../stores';
import { clearDocumentCache, documentCacheStats, loadChunks, qualityProfile } from '../../supertonic';
import { COVER_PALETTE, ty, TYPE, useTheme } from '../../theme';
import { documentToBook } from '../../utils';
import type { Book, ImportedDocument } from '../../types';
import type { AppNavigation } from '../../navigation/navigationTypes';
import { makeStyles } from './LibraryScreen.styles';

type Filter = 'all' | 'inprogress' | 'finished' | 'favourites';
type Sort = 'recent' | 'title' | 'progress';

const SORT_LABELS: Record<Sort, string> = { recent: 'Recently added', title: 'Title', progress: 'Progress' };

function formatSize(bytes: number): string {
  if (bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

// Library home: searchable/filterable/sortable book grid, per-book long-press
// menu (favourite, cover colour, audiobook, cache, delete), and background play.
export default function LibraryScreen() {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const navigation = useNavigation<AppNavigation>();
  const documents = useDocumentsStore((s) => s.documents);
  const cursor = useDocumentsStore((s) => s.cursor);
  const progress = useDocumentsStore((s) => s.progress);
  const favourites = useDocumentsStore((s) => s.favourites);
  const audiobook = useDocumentsStore((s) => s.audiobook);
  const toggleFavourite = useDocumentsStore((s) => s.toggleFavourite);
  const removeDocument = useDocumentsStore((s) => s.removeDocument);
  const clearAudiobook = useDocumentsStore((s) => s.clearAudiobook);
  const setCover = useDocumentsStore((s) => s.setCover);
  const { playback, activeDoc, clearActiveDoc, playDocument } = usePlaybackContext();
  const renderProfile = useDocumentsStore((s) => s.renderProfile);
  const setRenderProfile = useDocumentsStore((s) => s.setRenderProfile);
  const settings = useSettingsStore();
  const { importDocument } = useImportDocument();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [sortMenu, setSortMenu] = useState(false);
  const [menuDoc, setMenuDoc] = useState<ImportedDocument | null>(null);
  const [manageDoc, setManageDoc] = useState<ImportedDocument | null>(null);
  const [colorDoc, setColorDoc] = useState<ImportedDocument | null>(null);

  const books = useMemo(
    () =>
      documents.map((d) => {
        const b = documentToBook(d);
        const frac = progress[d.docHash] ?? 0;
        const isPlaying = activeDoc?.doc.docHash === d.docHash && playback.playing;
        const state = isPlaying ? 'playing' : frac >= 0.999 ? 'done' : b.state;
        return { ...b, progress: frac, state };
      }),
    [documents, progress, activeDoc?.doc.docHash, playback.playing],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchesFilter = (b: Book) =>
      filter === 'all'
        ? true
        : filter === 'favourites'
          ? favourites.includes(b.id)
          : filter === 'inprogress'
            ? b.progress > 0 && b.progress < 1
            : b.progress >= 1;
    const list = books.filter((b) => matchesFilter(b) && (q === '' || b.title.toLowerCase().includes(q)));
    if (sort === 'title') return [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'progress') return [...list].sort((a, b) => b.progress - a.progress);
    return list; // 'recent' — documents are already stored newest-first
  }, [books, filter, favourites, query, sort]);

  const openBook = (docId: string) => navigation.navigate('Reader', { docId });
  const openSettings = () => navigation.navigate('Settings');

  // Play from the list without leaving it: toggle if already active, open the
  // reader if not yet extracted, otherwise start background playback.
  const playBook = (docId: string) => {
    const doc = documents.find((d) => d.docHash === docId);
    if (!doc) return;
    if (activeDoc?.doc.docHash === docId) {
      playback.toggle();
      return;
    }
    const extracted = loadExtractedText(docId);
    if (!extracted) {
      openBook(docId); // not extracted yet — the reader will extract + resume
      return;
    }
    const rp = renderProfile[docId];
    const active: ActiveDoc = {
      doc,
      chunks: loadChunks(docId, extracted.text, qualityProfile(settings.quality).unitLen),
      text: extracted.text,
      modelId: rp?.modelId ?? settings.modelId,
      voiceId: rp?.voiceId ?? settings.voiceId,
      speed: rp?.speed ?? settings.speed,
      steps: rp?.steps ?? settings.steps,
      lang: rp?.lang ?? doc.lang ?? settings.lang ?? 'en',
      onSpeedChange: (v: number) => (rp ? setRenderProfile(docId, { ...rp, speed: v }) : settings.setSpeed(v)),
    };
    playDocument(active, cursor[docId] ?? 0);
  };
  const menuStats = menuDoc ? documentCacheStats(menuDoc.docHash) : null;
  // Lift the FAB above the mini-player when one is showing so they don't overlap.
  const pillVisible = !!activeDoc && playback.engaged;
  const audiobookFor = (docId: string) => {
    const a = audiobook[docId];
    if (!a) return undefined;
    return { value: a.total > 0 ? a.done / a.total : 0, status: a.status };
  };

  if (books.length === 0) {
    return (
      <View style={styles.screen}>
        <AppBar title="Library" actions={<IconButton icon="settings" onPress={openSettings} accessibilityLabel="Settings" />} />
        <EmptyLibrary onImport={importDocument} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppBar
        title="Library"
        subtitle={`${books.length} document${books.length === 1 ? '' : 's'}`}
        actions={
          <>
            <IconButton icon="search" onPress={() => setSearching((v) => !v)} accessibilityLabel="Search" />
            <IconButton icon="sort" onPress={() => setSortMenu(true)} accessibilityLabel="Sort" />
            <IconButton icon="settings" onPress={openSettings} accessibilityLabel="Settings" />
          </>
        }
      />
      {searching ? (
        <View style={styles.searchRow}>
          <Icon name="search" size={18} color={p.textDim} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by title"
            placeholderTextColor={p.textDim}
            autoFocus
            style={[ty(TYPE.body, p.text), styles.searchInput]}
          />
          {query ? <IconButton icon="close" onPress={() => setQuery('')} accessibilityLabel="Clear search" /> : null}
        </View>
      ) : null}
      <View style={styles.filterRow}>
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="In progress" selected={filter === 'inprogress'} onPress={() => setFilter('inprogress')} />
        <Chip label="Finished" selected={filter === 'finished'} onPress={() => setFilter('finished')} />
        <Chip label="Favourites" selected={filter === 'favourites'} onPress={() => setFilter('favourites')} />
      </View>
      {visible.length === 0 ? (
        <View style={styles.noMatch}>
          <Text style={[ty(TYPE.body, p.textMuted)]}>Nothing here yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {visible.map((b, i) => (
            <BookRow
              key={b.id}
              book={b}
              favourite={favourites.includes(b.id)}
              last={i === visible.length - 1}
              audiobook={audiobookFor(b.id)}
              onPress={() => openBook(b.id)}
              onPlay={() => playBook(b.id)}
              onLongPress={() => {
                const doc = documents.find((d) => d.docHash === b.id);
                if (doc) setMenuDoc(doc);
              }}
            />
          ))}
        </ScrollView>
      )}
      <FAB icon="plus" label="Import file" onPress={importDocument} raised={pillVisible} />

      <ActionDialog
        open={sortMenu}
        onClose={() => setSortMenu(false)}
        title="Sort by"
        actions={(['recent', 'title', 'progress'] as Sort[]).map((s) => ({
          label: SORT_LABELS[s],
          variant: sort === s ? 'filled' : 'tonal',
          onPress: () => setSort(s),
        }))}
      />

      <ActionDialog
        open={!!menuDoc}
        onClose={() => setMenuDoc(null)}
        title={menuDoc?.title}
        actions={
          menuDoc
            ? [
                {
                  label: cursor[menuDoc.docHash] != null ? 'Continue' : 'Play',
                  variant: 'filled',
                  onPress: () => navigation.navigate('Reader', { docId: menuDoc.docHash }),
                },
                {
                  label: favourites.includes(menuDoc.docHash) ? 'Remove from favourites' : 'Add to favourites',
                  variant: 'tonal',
                  onPress: () => toggleFavourite(menuDoc.docHash),
                },
                {
                  label: 'Change cover colour',
                  variant: 'tonal',
                  onPress: () => setColorDoc(menuDoc),
                },
                {
                  label: 'Make full audiobook',
                  variant: 'tonal',
                  onPress: () => navigation.navigate('Prerender', { docId: menuDoc.docHash }),
                },
                {
                  label: menuStats && menuStats.bytes > 0 ? `Manage cached audio · ${formatSize(menuStats.bytes)}` : 'Manage cached audio',
                  variant: 'tonal',
                  onPress: () => setManageDoc(menuDoc),
                },
                {
                  label: 'Delete',
                  variant: 'danger',
                  onPress: () => {
                    // Halt + release first if this doc is playing, else the player
                    // runs on from the loaded clip after its files are gone.
                    if (activeDoc?.doc.docHash === menuDoc.docHash) {
                      playback.stop();
                      clearActiveDoc();
                    }
                    clearDocumentCache(menuDoc.docHash);
                    clearAudiobook(menuDoc.docHash);
                    deleteExtractedText(menuDoc.docHash);
                    clearExtractedImages(menuDoc.docHash);
                    try {
                      new File(menuDoc.fileUri).delete();
                    } catch {}
                    removeDocument(menuDoc.docHash);
                  },
                },
                { label: 'Cancel', variant: 'ghost' },
              ]
            : []
        }
      />

      <ManageCacheSheet
        open={!!manageDoc}
        onClose={() => setManageDoc(null)}
        docHash={manageDoc?.docHash ?? null}
        title={manageDoc?.title}
      />

      <Sheet open={!!colorDoc} onClose={() => setColorDoc(null)} title="Cover colour" heightRatio={0.34}>
        <View style={styles.swatchRow}>
          {COVER_PALETTE.map((hue, i) => {
            const selected = colorDoc ? documentToBook(colorDoc).cover === i : false;
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`Cover colour ${i + 1}`}
                onPress={() => {
                  if (colorDoc) setCover(colorDoc.docHash, i);
                  setColorDoc(null);
                }}
                style={[
                  styles.swatch,
                  { backgroundColor: hue.bg, borderColor: selected ? p.primary : p.border, borderWidth: selected ? 3 : 1 },
                ]}
              />
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}
