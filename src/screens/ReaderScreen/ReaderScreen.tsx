import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View, type ViewToken } from 'react-native';
import { AppBar, Chip, Icon, IconButton, PageScrubber, PlayerControls, Sheet, Slider, Spinner, TapHint, voiceLabel } from '../../components';
import { usePageGeometry, usePdfText } from '../../hooks';
import type { ExtractedBlock } from '../../pdf';
import { useDocumentsStore, useSettingsStore } from '../../stores';
import { elevation, ty, TYPE, useTheme } from '../../theme';
import type { AppNavigation, ReaderRoute } from '../../navigation/navigationTypes';
import { flatSentenceIndex } from './flatSentenceIndex';
import { makeStyles } from './ReaderScreen.styles';

const SPEED_PRESETS = [0.9, 1.0, 1.05, 1.15, 1.25, 1.5];
const INDENT_STEP = 18;
const TOC_DOTS = Array(80).fill('·').join(' ');

// Color a TOC entry's leading section number (e.g. "2.1") with the accent.
function renderTocTitle(title: string, accent: string) {
  const m = title.match(/^(\d+(?:[.\s]+\d+)*\.?)(\s+)(.*)$/);
  if (!m) return title;
  return (
    <>
      <Text style={{ color: accent }}>{m[1]}</Text>
      {m[2] + m[3]}
    </>
  );
}

export default function ReaderScreen() {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const navigation = useNavigation<AppNavigation>();
  const route = useRoute<ReaderRoute>();
  const doc = useDocumentsStore((s) => s.documents.find((d) => d.docHash === route.params.docId));
  const voiceId = useSettingsStore((s) => s.voiceId);
  const settingsSpeed = useSettingsStore((s) => s.speed);

  const { status, document, pageCount, loadedPages, stage, error, extractor } = usePdfText(doc);

  const blocks = document?.blocks ?? [];
  // Map each PDF page to its blocks (with their global index, for the flat
  // sentence lookup that drives highlighting).
  const blocksByPage = useMemo(() => {
    const m = new Map<number, { block: ExtractedBlock; gbi: number }[]>();
    blocks.forEach((b, gbi) => {
      const arr = m.get(b.page);
      if (arr) arr.push({ block: b, gbi });
      else m.set(b.page, [{ block: b, gbi }]);
    });
    return m;
  }, [blocks]);
  const { getItemLayout, onPageLayout, version: geomVersion } = usePageGeometry(doc?.docHash, blocks, pageCount, status === 'ready');
  const flat = useMemo(() => flatSentenceIndex(blocks), [blocks]);
  // O(1) lookup of a sentence's flat index (block:sentence -> index) so block
  // rendering isn't O(sentences × all-sentences) — that quadratic cost is what
  // made page renders (and thus far jumps) crawl.
  const flatIndexByKey = useMemo(() => {
    const m = new Map<string, number>();
    flat.forEach((x, i) => m.set(`${x.bi}:${x.si}`, i));
    return m;
  }, [flat]);
  const total = flat.length;
  const hasPages = pageCount > 0;

  const listRef = useRef<FlatList<number>>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(settingsSpeed);
  const [speedSheet, setSpeedSheet] = useState(false);

  const data = useMemo(() => Array.from({ length: pageCount }, (_, i) => i + 1), [pageCount]);

  const onViewRef = useRef((info: { viewableItems: ViewToken[] }) => {
    const first = info.viewableItems.find((v) => v.index != null);
    if (first && first.index != null) setCurrentPage(first.index + 1);
  });
  const viewConfigRef = useRef({ itemVisiblePercentThreshold: 10 });

  // animated jumps smooth-scroll across every page in between (stuttery on a big
  // doc), so far jumps (scrubber, TOC) pass animated=false for an instant jump.
  const scrollToPage = useCallback(
    (page: number, animated = true) => {
      if (pageCount <= 0) return;
      const index = Math.max(0, Math.min(pageCount - 1, page - 1));
      listRef.current?.scrollToIndex({ index, viewPosition: 0, animated });
    },
    [pageCount],
  );

  const onScrollToIndexFailed = useCallback((info: { index: number; averageItemLength: number }) => {
    listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0, animated: false });
    }, 60);
  }, []);

  const labelForPage = useCallback(
    (pg: number) => {
      const items = blocksByPage.get(pg);
      const heading = items?.find(({ block }) => block.kind === 'h2');
      const title = heading && heading.block.kind === 'h2' ? heading.block.text : '';
      if (!title) return `Page ${pg}`;
      return `Page ${pg} · ${title.length > 30 ? title.slice(0, 30) + '…' : title}`;
    },
    [blocksByPage],
  );

  const renderBlock = (b: ExtractedBlock, gbi: number) => {
    const pad = { paddingLeft: b.indent * INDENT_STEP };
    if (b.kind === 'h2') {
      return <Text key={gbi} style={[ty(TYPE.titleSerif, p.text), styles.heading, pad]}>{b.text}</Text>;
    }
    if (b.kind === 'toc') {
      const target = b.target ? parseInt(b.target, 10) : NaN;
      return (
        <Pressable key={gbi} onPress={() => { if (!Number.isNaN(target)) scrollToPage(target, false); }} style={[styles.tocRow, pad]}>
          <Text style={[ty(TYPE.body, p.text), styles.tocTitle]}>{renderTocTitle(b.title, p.primary)}</Text>
          <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.tocLeader, { color: p.textDim }]}>{TOC_DOTS}</Text>
          {b.target ? <Text style={ty(TYPE.label, p.primary)}>{b.target}</Text> : null}
        </Pressable>
      );
    }
    return (
      <Text key={gbi} style={[ty(TYPE.reader, p.text), styles.paragraph, pad]}>
        {b.sentences.map((s, si) => {
          const flatIdx = playing ? flatIndexByKey.get(`${gbi}:${si}`) ?? -1 : -1;
          const isCurrent = flatIdx === current && playing;
          const color = isCurrent ? p.highlightInk : playing && flatIdx < current ? p.textMuted : p.text;
          return (
            <Text key={si} onPress={() => { setCurrent(flatIdx); setPlaying(true); }} style={{ color, backgroundColor: isCurrent ? p.highlight : 'transparent' }}>
              {s.text}{si < b.sentences.length - 1 ? ' ' : ''}
            </Text>
          );
        })}
      </Text>
    );
  };

  const renderSlot = (pg: number) => {
    const items = blocksByPage.get(pg);
    return (
      <View
        style={styles.pageSection}
        onLayout={(e) => { if (items?.length || pg <= loadedPages) onPageLayout(pg, e.nativeEvent.layout.height); }}
      >
        <Text style={[ty(TYPE.caption, p.textDim), styles.pageDivider]}>Page {pg}</Text>
        {items && items.length ? (
          <View style={[styles.card, elevation(1)]}>{items.map(({ block, gbi }) => renderBlock(block, gbi))}</View>
        ) : pg <= loadedPages ? (
          <View style={[styles.card, styles.emptyPage]}>
            <Text style={ty(TYPE.caption, p.textDim)}>No text on this page</Text>
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
    <View style={styles.screen}>
      <AppBar onBack={() => navigation.goBack()} title={doc?.title} subtitle={pageCount > 0 ? `${pageCount} pages` : undefined} actions={<IconButton icon="more" accessibilityLabel="More" />} />

      <View style={styles.body}>
        {status === 'loading' ? (
          <View style={styles.emptyState}>
            <Spinner size={26} color={p.primary} />
            <Text style={[ty(TYPE.body, p.textMuted), styles.emptyText]}>Opening the document…</Text>
            {stage ? <Text style={ty(TYPE.caption, p.textDim)}>{stage}</Text> : null}
          </View>
        ) : status === 'error' ? (
          <View style={styles.emptyState}>
            <Icon name="book" size={40} color={p.textDim} />
            <Text style={[ty(TYPE.body, p.textMuted), styles.emptyText]}>Couldn’t read this PDF.</Text>
            {error ? <Text style={ty(TYPE.caption, p.textDim)}>{error}</Text> : null}
          </View>
        ) : status === 'ready' && blocks.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="book" size={40} color={p.textDim} />
            <Text style={[ty(TYPE.body, p.textMuted), styles.emptyText]}>No selectable text found.</Text>
            <Text style={ty(TYPE.caption, p.textDim)}>This PDF may be scanned images.</Text>
          </View>
        ) : hasPages ? (
          <>
            <FlatList
              ref={listRef}
              data={data}
              extraData={`${loadedPages}:${geomVersion}`}
              keyExtractor={(pg) => String(pg)}
              renderItem={({ item }) => renderSlot(item)}
              getItemLayout={getItemLayout}
              initialNumToRender={3}
              maxToRenderPerBatch={4}
              windowSize={9}
              removeClippedSubviews
              onViewableItemsChanged={onViewRef.current}
              viewabilityConfig={viewConfigRef.current}
              onScrollToIndexFailed={onScrollToIndexFailed}
              contentContainerStyle={styles.scrollContent}
            />
            <PageScrubber pageCount={pageCount} currentPage={currentPage} labelForPage={labelForPage} onJumpToPage={(pg) => scrollToPage(pg, false)} />
          </>
        ) : (
          <View style={styles.emptyState}>
            <Icon name="book" size={40} color={p.textDim} />
            <Text style={[ty(TYPE.body, p.textMuted), styles.emptyText]}>No document open.</Text>
          </View>
        )}
        {hasPages && status === 'ready' && !playing && current === 0 ? <TapHint /> : null}
      </View>

      {hasPages ? (
        <View style={styles.pageBar}>
          <IconButton icon="back" onPress={() => scrollToPage(currentPage - 1)} accessibilityLabel="Previous page" />
          <Text style={ty(TYPE.label, p.textMuted)}>
            Page {currentPage} / {pageCount}
            {status === 'streaming' ? `  ·  ${loadedPages} loaded` : ''}
          </Text>
          <IconButton icon="chevR" onPress={() => scrollToPage(currentPage + 1)} accessibilityLabel="Next page" />
        </View>
      ) : null}

      <PlayerControls
        playing={playing}
        onTogglePlay={() => setPlaying((v) => !v)}
        onSkipBack={() => setCurrent((c) => Math.max(0, c - 1))}
        onSkipFwd={() => setCurrent((c) => Math.min(Math.max(0, total - 1), c + 1))}
        progress={progress}
        onScrub={setProgress}
        position="0:00"
        duration="0:00"
        speed={speed}
        onSpeed={() => setSpeedSheet(true)}
        voiceName={voiceLabel(voiceId)}
      />

      <Sheet open={speedSheet} onClose={() => setSpeedSheet(false)} title="Playback speed" heightRatio={0.42}>
        <View style={styles.sheetBody}>
          <Text style={[ty(TYPE.display, p.text), styles.speedValue]}>×{speed.toFixed(2)}</Text>
          <Slider value={speed} min={0.9} max={1.5} step={0.05} onChange={setSpeed} ticks={[0.9, 1.0, 1.05, 1.25, 1.5]} />
          <View style={styles.sliderLabels}>
            <Text style={ty(TYPE.mono, p.textMuted)}>0.90</Text>
            <Text style={ty(TYPE.mono, p.textMuted)}>1.50</Text>
          </View>
          <View style={styles.presetRow}>
            {SPEED_PRESETS.map((v) => (
              <Chip key={v} label={`×${v.toFixed(2)}`} selected={Math.abs(speed - v) < 0.01} onPress={() => setSpeed(v)} />
            ))}
          </View>
        </View>
      </Sheet>

      {extractor}
    </View>
  );
}
