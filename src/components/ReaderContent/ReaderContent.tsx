import { useMemo, useRef, type RefObject } from 'react';
import { FlatList, Image, Pressable, Text, View, type ViewToken } from 'react-native';
import type { PageGeometry, PdfTextStatus } from '../../hooks';
import type { ExtractedBlock } from '../../pdf';
import { elevation, ty, TYPE, useTheme } from '../../theme';
import type { Chunk, ImportedDocument } from '../../types';
import { rangesOverlap } from '../../utils';
import { Chip } from '../Chip';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import { PageScrubber } from '../PageScrubber';
import { Spinner } from '../Spinner';
import { TapHint } from '../TapHint';
import { makeStyles } from './ReaderContent.styles';

const INDENT_STEP = 18;
const TOC_DOTS = Array(80).fill('·').join(' ');

type PageBlock = { block: ExtractedBlock; gbi: number };

type ReaderContentProps = {
  listRef: RefObject<FlatList<number> | null>;
  status: PdfTextStatus;
  stage: string;
  error?: string;
  documentKind?: ImportedDocument['kind'];
  blocksByPage: Map<number, PageBlock[]>;
  data: number[];
  pageCount: number;
  loadedPages: number;
  geometryVersion: number;
  currentPage: number;
  activeChunk: Chunk | null;
  pendingChunk: Chunk | null;
  showHint: boolean;
  followMode: boolean;
  getItemLayout: PageGeometry['getItemLayout'];
  onPageLayout: PageGeometry['onPageLayout'];
  onPageChanged: (page: number) => void;
  onUserScroll: () => void;
  onBlockLayout: (
    globalIndex: number,
    page: number,
    charStart: number,
    charEnd: number,
    y: number,
    height: number,
  ) => void;
  onScrollToIndexFailed: (info: { index: number; averageItemLength: number }) => void;
  onJumpToPage: (page: number, animated?: boolean) => void;
  onToggleFollow: () => void;
  onSentencePress: (charStart: number) => void;
  onContentsPress: (title: string, target: number, charStart: number) => void;
  onDismissHint: () => void;
};

function renderContentsTitle(title: string, accent: string) {
  const match = title.match(/^(\d+(?:[.\s]+\d+)*\.?)(\s+)(.*)$/);
  if (!match) return title;
  return (
    <>
      <Text style={{ color: accent }}>{match[1]}</Text>
      {match[2] + match[3]}
    </>
  );
}

export function ReaderContent({
  listRef,
  status,
  stage,
  error,
  documentKind,
  blocksByPage,
  data,
  pageCount,
  loadedPages,
  geometryVersion,
  currentPage,
  activeChunk,
  pendingChunk,
  showHint,
  followMode,
  getItemLayout,
  onPageLayout,
  onPageChanged,
  onUserScroll,
  onBlockLayout,
  onScrollToIndexFailed,
  onJumpToPage,
  onToggleFollow,
  onSentencePress,
  onContentsPress,
  onDismissHint,
}: ReaderContentProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const viewConfig = useRef({ itemVisiblePercentThreshold: 10 });
  const hasPages = pageCount > 0;

  const labelForPage = (page: number) => {
    const items = blocksByPage.get(page);
    const heading = items?.find(({ block }) => block.kind === 'h2');
    const title = heading && heading.block.kind === 'h2' ? heading.block.text : '';
    if (!title) return `Page ${page}`;
    return `Page ${page} · ${title.length > 30 ? `${title.slice(0, 30)}…` : title}`;
  };

  const onViewableItemsChanged = (info: { viewableItems: ViewToken[] }) => {
    const first = info.viewableItems.find((item) => item.index != null);
    if (first?.index != null) onPageChanged(first.index + 1);
  };
  const viewableHandler = useRef(onViewableItemsChanged);

  const overlapsActiveChunk = (charStart: number, charEnd: number) =>
    !!activeChunk && rangesOverlap(charStart, charEnd, activeChunk.charStart, activeChunk.charEnd);
  const overlapsPendingChunk = (charStart: number, charEnd: number) =>
    !!pendingChunk && rangesOverlap(charStart, charEnd, pendingChunk.charStart, pendingChunk.charEnd);

  const renderBlock = (block: ExtractedBlock, globalIndex: number, page: number) => {
    const padding = { paddingLeft: block.indent * INDENT_STEP };
    if (block.kind === 'pageHeader') {
      return (
        <View key={globalIndex} style={styles.pageHeader}>
          <Text numberOfLines={1} style={ty(TYPE.caption, palette.textDim)}>{block.text}</Text>
        </View>
      );
    }
    if (block.kind === 'image') {
      if (!block.uri) return null;
      const aspectRatio = block.width > 0 && block.height > 0 ? block.width / block.height : 1;
      return <Image key={globalIndex} source={{ uri: block.uri }} style={[styles.image, { aspectRatio }]} resizeMode="contain" />;
    }
    if (block.kind === 'h2') {
      const isCurrent = overlapsActiveChunk(block.charStart, block.charEnd);
      const isRead = !!activeChunk && block.charEnd <= activeChunk.charStart;
      return (
        <Text
          key={globalIndex}
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            onBlockLayout(globalIndex, page, block.charStart, block.charEnd, y, height);
          }}
          onPress={() => onSentencePress(block.charStart)}
          style={[
            ty(TYPE.titleSerif, isCurrent ? palette.highlightInk : isRead ? palette.textMuted : palette.text),
            styles.heading,
            padding,
            isCurrent ? { backgroundColor: palette.highlight } : null,
          ]}
        >
          {block.text}
        </Text>
      );
    }
    if (block.kind === 'toc') {
      const target = block.target ? parseInt(block.target, 10) : NaN;
      return (
        <Pressable key={globalIndex} onPress={() => onContentsPress(block.title, target, block.charStart)} style={[styles.tocRow, padding]}>
          <Text style={[ty(TYPE.body, palette.text), styles.tocTitle]}>{renderContentsTitle(block.title, palette.primary)}</Text>
          <Text numberOfLines={1} ellipsizeMode="clip" style={[ty(TYPE.caption, palette.textDim), styles.tocLeader]}>{TOC_DOTS}</Text>
          {block.target ? <Text style={ty(TYPE.label, palette.primary)}>{block.target}</Text> : null}
        </Pressable>
      );
    }
    return (
      <Pressable
        key={globalIndex}
        onLayout={(event) => {
          const { y, height } = event.nativeEvent.layout;
          onBlockLayout(globalIndex, page, block.charStart, block.charEnd, y, height);
        }}
        onPress={() => onSentencePress(block.sentences[0]?.charStart ?? block.charStart)}
        style={[padding, styles.paragraph]}
      >
        <Text style={ty(TYPE.reader, palette.text)}>
          {block.sentences.map((sentence, index) => {
            const isCurrent = overlapsActiveChunk(sentence.charStart, sentence.charEnd);
            const isPending = overlapsPendingChunk(sentence.charStart, sentence.charEnd);
            const isRead = !!activeChunk && sentence.charEnd <= activeChunk.charStart;
            const color = isCurrent ? palette.highlightInk : isRead ? palette.textMuted : palette.text;
            const backgroundColor = isCurrent ? palette.highlight : isPending ? palette.surfaceAlt : 'transparent';
            return (
              <Text key={index} onPress={() => onSentencePress(sentence.charStart)} style={{ color, backgroundColor }}>
                {sentence.text}{index < block.sentences.length - 1 ? ' ' : ''}
              </Text>
            );
          })}
        </Text>
      </Pressable>
    );
  };

  const renderPage = (page: number) => {
    const items = blocksByPage.get(page);
    return (
      <View
        style={styles.pageSection}
        onLayout={(event) => {
          if (items?.length || page <= loadedPages) onPageLayout(page, event.nativeEvent.layout.height);
        }}
      >
        <Text style={[ty(TYPE.caption, palette.textDim), styles.pageDivider]}>Page {page}</Text>
        {items?.length ? (
          <View style={[styles.card, elevation(1)]}>{items.map(({ block, gbi }) => renderBlock(block, gbi, page))}</View>
        ) : page <= loadedPages ? (
          <View style={[styles.card, styles.emptyPage]}>
            <Text style={ty(TYPE.caption, palette.textDim)}>No text on this page</Text>
          </View>
        ) : (
          <View style={[styles.card, styles.placeholderCard]}>
            <View style={styles.skelLine} />
            <View style={[styles.skelLine, { width: '92%' }]} />
            <View style={[styles.skelLine, { width: '80%' }]} />
            <View style={[styles.skelLine, { width: '88%' }]} />
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <View style={styles.body} onTouchStart={showHint ? onDismissHint : undefined}>
        {status === 'loading' ? (
          <View style={styles.emptyState}>
            <Spinner size={26} color={palette.primary} />
            <Text style={[ty(TYPE.body, palette.textMuted), styles.emptyText]}>Opening the document…</Text>
            {stage ? <Text style={ty(TYPE.caption, palette.textDim)}>{stage}</Text> : null}
          </View>
        ) : status === 'error' ? (
          <View style={styles.emptyState}>
            <Icon name="book" size={40} color={palette.textDim} />
            <Text style={[ty(TYPE.body, palette.textMuted), styles.emptyText]}>Couldn’t read this document.</Text>
            {error ? <Text style={ty(TYPE.caption, palette.textDim)}>{error}</Text> : null}
          </View>
        ) : status === 'ready' && blocksByPage.size === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="book" size={40} color={palette.textDim} />
            <Text style={[ty(TYPE.body, palette.textMuted), styles.emptyText]}>No selectable text found.</Text>
            <Text style={ty(TYPE.caption, palette.textDim)}>{documentKind === 'pdf' || !documentKind ? 'This PDF may be scanned images.' : 'This file appears to be empty.'}</Text>
          </View>
        ) : hasPages ? (
          <>
            <FlatList
              ref={listRef}
              data={data}
              extraData={`${loadedPages}:${geometryVersion}:${activeChunk?.charStart ?? -1}:${activeChunk?.charEnd ?? -1}:${pendingChunk?.charStart ?? -1}:${pendingChunk?.charEnd ?? -1}`}
              keyExtractor={(page) => String(page)}
              renderItem={({ item }) => renderPage(item)}
              getItemLayout={getItemLayout}
              initialNumToRender={3}
              maxToRenderPerBatch={4}
              windowSize={9}
              removeClippedSubviews
              onViewableItemsChanged={viewableHandler.current}
              viewabilityConfig={viewConfig.current}
              onScrollBeginDrag={onUserScroll}
              onScrollToIndexFailed={onScrollToIndexFailed}
              contentContainerStyle={styles.scrollContent}
            />
            <PageScrubber pageCount={pageCount} currentPage={currentPage} labelForPage={labelForPage} onJumpToPage={(page) => onJumpToPage(page, false)} />
          </>
        ) : (
          <View style={styles.emptyState}>
            <Icon name="book" size={40} color={palette.textDim} />
            <Text style={[ty(TYPE.body, palette.textMuted), styles.emptyText]}>No document open.</Text>
          </View>
        )}
        {showHint ? <TapHint onClose={onDismissHint} /> : null}
      </View>

      {hasPages ? (
        <View style={styles.pageBar}>
          <Chip label="Read along" selected={followMode} onPress={onToggleFollow} />
          <Text style={ty(TYPE.label, palette.textMuted)}>
            Page {currentPage} / {pageCount}
            {status === 'streaming' ? `  ·  ${loadedPages} loaded` : ''}
          </Text>
          <View style={styles.pageNav}>
            <IconButton icon="back" onPress={() => onJumpToPage(currentPage - 1)} accessibilityLabel="Previous page" />
            <IconButton icon="chevR" onPress={() => onJumpToPage(currentPage + 1)} accessibilityLabel="Next page" />
          </View>
        </View>
      ) : null}
    </>
  );
}
