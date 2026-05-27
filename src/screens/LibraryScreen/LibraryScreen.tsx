import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppBar, BookRow, Button, Chip, EmptyArt, FAB, IconButton, NowPlayingPill } from '../../components';
import type { Book } from '../../types';
import { ty, TYPE, useTheme } from '../../theme';
import { makeStyles } from './LibraryScreen.styles';

type Filter = 'all' | 'inprogress' | 'finished';

type LibraryScreenProps = {
  books?: Book[];
  onOpenBook?: (book: Book) => void;
  onImport?: () => void;
  onOpenSettings?: () => void;
};

export default function LibraryScreen({ books = [], onOpenBook, onImport, onOpenSettings }: LibraryScreenProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const [filter, setFilter] = useState<Filter>('all');

  const visible = books.filter((b) =>
    filter === 'all' ? true : filter === 'inprogress' ? b.progress > 0 && b.progress < 1 : b.progress >= 1,
  );
  const playing = books.find((b) => b.state === 'playing');

  if (books.length === 0) {
    return (
      <View style={styles.screen}>
        <AppBar title="Library" actions={<IconButton icon="settings" onPress={onOpenSettings} accessibilityLabel="Settings" />} />
        <View style={styles.emptyBody}>
          <EmptyArt />
          <Text style={[ty(TYPE.titleLarge, p.text), styles.emptyTitle]}>A library that reads to you</Text>
          <Text style={[ty(TYPE.body, p.textMuted), styles.emptyText]}>
            Import a PDF and tap anywhere in the text. The voice picks up from there — fully offline.
          </Text>
          <Button label="Import PDF" icon="import" size="lg" variant="filled" full onPress={onImport} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppBar
        title="Library"
        subtitle={`${books.length} document${books.length === 1 ? '' : 's'}`}
        actions={<><IconButton icon="search" accessibilityLabel="Search" /><IconButton icon="settings" onPress={onOpenSettings} accessibilityLabel="Settings" /></>}
      />
      <View style={styles.filterRow}>
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="In progress" selected={filter === 'inprogress'} onPress={() => setFilter('inprogress')} />
        <Chip label="Finished" selected={filter === 'finished'} onPress={() => setFilter('finished')} />
      </View>
      <ScrollView contentContainerStyle={styles.listContent}>
        {visible.map((b, i) => (
          <BookRow key={b.id} book={b} last={i === visible.length - 1} onPress={() => onOpenBook?.(b)} />
        ))}
      </ScrollView>
      {playing ? <NowPlayingPill book={playing} onPress={() => onOpenBook?.(playing)} /> : null}
      <FAB icon="plus" label="Import PDF" onPress={onImport} />
    </View>
  );
}
