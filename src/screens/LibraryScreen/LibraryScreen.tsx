import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { File } from 'expo-file-system';
import { ActionDialog, AppBar, BookRow, Button, Chip, EmptyArt, FAB, Icon, IconButton } from '../../components';
import { useImportDocument } from '../../hooks';
import { deleteExtractedText } from '../../pdf/extractedTextCache';
import { usePlaybackContext } from '../../playback';
import { useDocumentsStore } from '../../stores';
import { clearDocumentCache, documentCacheStats } from '../../supertonic';
import { ty, TYPE, useTheme } from '../../theme';
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

export default function LibraryScreen() {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const navigation = useNavigation<AppNavigation>();
  const documents = useDocumentsStore((s) => s.documents);
  const cursor = useDocumentsStore((s) => s.cursor);
  const favourites = useDocumentsStore((s) => s.favourites);
  const audiobook = useDocumentsStore((s) => s.audiobook);
  const toggleFavourite = useDocumentsStore((s) => s.toggleFavourite);
  const removeDocument = useDocumentsStore((s) => s.removeDocument);
  const clearAudiobook = useDocumentsStore((s) => s.clearAudiobook);
  const { playback, activeDoc, clearActiveDoc } = usePlaybackContext();
  const { importDocument } = useImportDocument();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [sortMenu, setSortMenu] = useState(false);
  const [menuDoc, setMenuDoc] = useState<ImportedDocument | null>(null);

  const books = useMemo(() => documents.map(documentToBook), [documents]);

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
  const menuStats = menuDoc ? documentCacheStats(menuDoc.docHash) : null;
  // The floating mini-player is visible here whenever a document is engaged; lift
  // the FAB above it so they don't overlap.
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
        <View style={styles.emptyBody}>
          <EmptyArt />
          <Text style={[ty(TYPE.titleLarge, p.text), styles.emptyTitle]}>A library that reads to you</Text>
          <Text style={[ty(TYPE.body, p.textMuted), styles.emptyText]}>
            Import a PDF, Markdown, or Word file and tap anywhere in the text. The voice picks up from there — fully offline.
          </Text>
          <Button label="Import file" icon="import" size="lg" variant="filled" full onPress={importDocument} />
        </View>
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
                  label: 'Make full audiobook',
                  variant: 'tonal',
                  onPress: () => navigation.navigate('Prerender', { docId: menuDoc.docHash }),
                },
                {
                  label: menuStats && menuStats.bytes > 0 ? `Clear cached audio · ${formatSize(menuStats.bytes)}` : 'Clear cached audio',
                  variant: 'tonal',
                  onPress: () => {
                    // Stop playback if we're wiping the cache out from under it.
                    if (activeDoc?.doc.docHash === menuDoc.docHash) playback.stop();
                    clearDocumentCache(menuDoc.docHash);
                    clearAudiobook(menuDoc.docHash);
                  },
                },
                {
                  label: 'Delete',
                  variant: 'danger',
                  onPress: () => {
                    // If the doc being deleted is the one playing, halt audio and
                    // release it first — otherwise the player keeps going from the
                    // already-loaded clip after its files are gone.
                    if (activeDoc?.doc.docHash === menuDoc.docHash) {
                      playback.stop();
                      clearActiveDoc();
                    }
                    clearDocumentCache(menuDoc.docHash);
                    clearAudiobook(menuDoc.docHash);
                    deleteExtractedText(menuDoc.docHash);
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
    </View>
  );
}
