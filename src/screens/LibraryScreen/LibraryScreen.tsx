import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppBar, BookRow, Button, Chip, EmptyArt, FAB, IconButton } from '../../components';
import { useImportDocument } from '../../hooks';
import { useDocumentsStore } from '../../stores';
import { ty, TYPE, useTheme } from '../../theme';
import { documentToBook } from '../../utils';
import type { AppNavigation } from '../../navigation/navigationTypes';
import { makeStyles } from './LibraryScreen.styles';

type Filter = 'all' | 'inprogress' | 'finished';

export default function LibraryScreen() {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const navigation = useNavigation<AppNavigation>();
  const documents = useDocumentsStore((s) => s.documents);
  const { importDocument } = useImportDocument();
  const [filter, setFilter] = useState<Filter>('all');

  const books = useMemo(() => documents.map(documentToBook), [documents]);
  const visible = books.filter((b) =>
    filter === 'all' ? true : filter === 'inprogress' ? b.progress > 0 && b.progress < 1 : b.progress >= 1,
  );

  const openBook = (docId: string) => navigation.navigate('Reader', { docId });
  const openSettings = () => navigation.navigate('Settings');

  if (books.length === 0) {
    return (
      <View style={styles.screen}>
        <AppBar title="Library" actions={<IconButton icon="settings" onPress={openSettings} accessibilityLabel="Settings" />} />
        <View style={styles.emptyBody}>
          <EmptyArt />
          <Text style={[ty(TYPE.titleLarge, p.text), styles.emptyTitle]}>A library that reads to you</Text>
          <Text style={[ty(TYPE.body, p.textMuted), styles.emptyText]}>
            Import a PDF and tap anywhere in the text. The voice picks up from there — fully offline.
          </Text>
          <Button label="Import PDF" icon="import" size="lg" variant="filled" full onPress={importDocument} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppBar
        title="Library"
        subtitle={`${books.length} document${books.length === 1 ? '' : 's'}`}
        actions={<><IconButton icon="search" accessibilityLabel="Search" /><IconButton icon="settings" onPress={openSettings} accessibilityLabel="Settings" /></>}
      />
      <View style={styles.filterRow}>
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="In progress" selected={filter === 'inprogress'} onPress={() => setFilter('inprogress')} />
        <Chip label="Finished" selected={filter === 'finished'} onPress={() => setFilter('finished')} />
      </View>
      <ScrollView contentContainerStyle={styles.listContent}>
        {visible.map((b, i) => (
          <BookRow key={b.id} book={b} last={i === visible.length - 1} onPress={() => openBook(b.id)} />
        ))}
      </ScrollView>
      <FAB icon="plus" label="Import PDF" onPress={importDocument} />
    </View>
  );
}
