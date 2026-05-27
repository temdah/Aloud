import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppBar, Button, Chip, IconButton } from '../../components';
import { BookRow } from './BookRow';
import { EmptyArt } from './EmptyArt';
import { FAB } from './FAB';
import { NowPlayingPill } from './NowPlayingPill';
import type { Book } from './libraryTypes';
import { ty, TYPE, useTheme } from '../../theme';

type Filter = 'all' | 'inprogress' | 'finished';

type LibraryScreenProps = {
  books?: Book[];
  onOpenBook?: (book: Book) => void;
  onImport?: () => void;
  onOpenSettings?: () => void;
};

export default function LibraryScreen({ books = [], onOpenBook, onImport, onOpenSettings }: LibraryScreenProps) {
  const { palette: p } = useTheme();
  const [filter, setFilter] = useState<Filter>('all');

  const visible = books.filter((b) =>
    filter === 'all' ? true : filter === 'inprogress' ? b.progress > 0 && b.progress < 1 : b.progress >= 1,
  );
  const playing = books.find((b) => b.state === 'playing');

  if (books.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: p.background }}>
        <AppBar title="Library" actions={<IconButton icon="settings" onPress={onOpenSettings} accessibilityLabel="Settings" />} />
        <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}>
          <EmptyArt />
          <Text style={[ty(TYPE.titleLarge, p.text), { marginTop: 32, textAlign: 'center' }]}>A library that reads to you</Text>
          <Text style={[ty(TYPE.body, p.textMuted), { marginTop: 10, marginBottom: 32, textAlign: 'center' }]}>
            Import a PDF and tap anywhere in the text. The voice picks up from there — fully offline.
          </Text>
          <Button label="Import PDF" icon="import" size="lg" variant="filled" full onPress={onImport} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.background }}>
      <AppBar
        title="Library"
        subtitle={`${books.length} document${books.length === 1 ? '' : 's'}`}
        actions={<><IconButton icon="search" accessibilityLabel="Search" /><IconButton icon="settings" onPress={onOpenSettings} accessibilityLabel="Settings" /></>}
      />
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="In progress" selected={filter === 'inprogress'} onPress={() => setFilter('inprogress')} />
        <Chip label="Finished" selected={filter === 'finished'} onPress={() => setFilter('finished')} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {visible.map((b, i) => (
          <BookRow key={b.id} book={b} last={i === visible.length - 1} onPress={() => onOpenBook?.(b)} />
        ))}
      </ScrollView>
      {playing ? <NowPlayingPill book={playing} onPress={() => onOpenBook?.(playing)} /> : null}
      <FAB icon="plus" label="Import PDF" onPress={onImport} />
    </View>
  );
}
