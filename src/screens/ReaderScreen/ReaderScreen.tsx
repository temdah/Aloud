import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View, type ViewToken } from 'react-native';
import { ActionDialog, AppBar, Chip, Icon, IconButton, PageScrubber, PlayerControls, Sheet, Slider, Spinner, TapHint, voiceLabel, type DialogAction } from '../../components';
import { usePageGeometry, usePdfText, usePlayback } from '../../hooks';
import type { ExtractedBlock } from '../../pdf';
import { useDocumentsStore, useSettingsStore } from '../../stores';
import { loadChunks } from '../../supertonic';
import { elevation, ty, TYPE, useTheme } from '../../theme';
import type { AppNavigation, ReaderRoute } from '../../navigation/navigationTypes';
import { makeStyles } from './ReaderScreen.styles';

const SPEED_PRESETS = [0.9, 1.0, 1.05, 1.15, 1.25, 1.5];
const INDENT_STEP = 18;
const TOC_DOTS = Array(80).fill('·').join(' ');

// mm:ss for a duration in seconds (audio positions/durations).
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

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
  const markHintSeen = useDocumentsStore((s) => s.markHintSeen);
  const setCursor = useDocumentsStore((s) => s.setCursor);
  const renderProfile = useDocumentsStore((s) => s.renderProfile[route.params.docId]);
  const setRenderProfile = useDocumentsStore((s) => s.setRenderProfile);
  const modelId = useSettingsStore((s) => s.modelId);
  const voiceId = useSettingsStore((s) => s.voiceId);
  const speed = useSettingsStore((s) => s.speed);
  const setSpeed = useSettingsStore((s) => s.setSpeed);
  const steps = useSettingsStore((s) => s.steps);

  // A document that was pre-rendered ("full audiobook") pins the exact narration
  // settings it was made with; the reader uses those so tap-to-start reads the
  // pre-rendered cache instead of re-synthesizing. Otherwise fall back to the
  // global voice settings.
  const effModelId = renderProfile?.modelId ?? modelId;
  const effVoiceId = renderProfile?.voiceId ?? voiceId;
  const effSteps = renderProfile?.steps ?? steps;
  const effLang = renderProfile?.lang ?? 'en';
  const effSpeed = renderProfile?.speed ?? speed;
  const setEffSpeed = useCallback(
    (v: number) => {
      if (renderProfile) setRenderProfile(route.params.docId, { ...renderProfile, speed: v });
      else setSpeed(v);
    },
    [renderProfile, setRenderProfile, route.params.docId, setSpeed],
  );

  const { status, document, pageCount, loadedPages, stage, error, extractor } = usePdfText(doc);

  const blocks = document?.blocks ?? [];
  // Map each PDF page to its blocks (with their global index, used as the
  // render key for each block).
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

  // Canonical chunk list (playback order + char ranges into document.text),
  // built/persisted once the text layer is ready. The same string drives both
  // the chunk boundaries and the rendered sentences, so char offsets join them.
  const chunks = useMemo(
    () => (status === 'ready' && doc && document?.text ? loadChunks(doc.docHash, document.text) : []),
    [status, doc?.docHash, document?.text],
  );

  const playback = usePlayback({ docHash: doc?.docHash ?? '', chunks, text: document?.text ?? '', modelId: effModelId, voiceId: effVoiceId, speed: effSpeed, steps: effSteps, lang: effLang });

  // Highlight the selected/playing chunk once the user has engaged (tapped a
  // sentence or pressed play); nothing is highlighted before that.
  const activeChunk = playback.engaged ? playback.currentChunk : null;
  const hasPages = pageCount > 0;

  // Tapping a sentence only selects + highlights it (free, no model needed).
  // Pressing play needs a model — route to the picker when none is chosen yet.
  const onTogglePlay = useCallback(() => {
    if (!effModelId) return navigation.navigate('VoiceModel');
    playback.toggle();
  }, [effModelId, navigation, playback]);

  const listRef = useRef<FlatList<number>>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);
  const [speedSheet, setSpeedSheet] = useState(false);
  const [tocPrompt, setTocPrompt] = useState<{ title: string; target: number; charStart: number } | null>(null);
  const [showHint, setShowHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Follow mode: when on, the view tracks the spoken sentence; when off, the user
  // scrolls freely. A tapped-while-playing sentence is held as a pending offset
  // (gray highlight) until the user confirms via the play-from-here prompt.
  const [followMode, setFollowMode] = useState(true);
  const [pendingOffset, setPendingOffset] = useState<number | null>(null);
  const [playPrompt, setPlayPrompt] = useState(false);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  // Tapping a sentence: no model → go pick one; already playing → ask before
  // hijacking the audio (hold the tap as a pending selection); otherwise just
  // select + highlight it (press play to start there).
  const handleSentenceTap = useCallback(
    (charStart: number) => {
      if (!modelId) {
        navigation.navigate('VoiceModel');
        return;
      }
      if (playback.playing) {
        setPendingOffset(charStart);
        setPlayPrompt(true);
      } else {
        playback.select(charStart);
      }
    },
    [modelId, navigation, playback],
  );

  const pendingChunk = useMemo(
    () => (pendingOffset == null ? null : chunks.find((c) => pendingOffset >= c.charStart && pendingOffset < c.charEnd) ?? null),
    [pendingOffset, chunks],
  );

  const clearPending = useCallback(() => {
    setPlayPrompt(false);
    setPendingOffset(null);
  }, []);

  // First-open hint: show once per document (persisted), auto-dismiss after 10s.
  useEffect(() => {
    if (status !== 'ready' || !doc) return;
    if (useDocumentsStore.getState().hintsSeen.includes(doc.docHash)) return;
    setShowHint(true);
    markHintSeen(doc.docHash);
    hintTimer.current = setTimeout(() => setShowHint(false), 10000);
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, [status, doc?.docHash, markHintSeen]);

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

  const pageForOffset = useCallback(
    (offset: number) => blocks.find((b) => offset >= b.charStart && offset < b.charEnd)?.page,
    [blocks],
  );

  // Scroll to a char offset's approximate vertical spot within its page (not the
  // page top), using the geometry offset table + the offset's fractional
  // position among that page's blocks, with a little headroom above.
  const scrollToReadingOffset = useCallback(
    (charOffset: number, animated = true) => {
      const page = pageForOffset(charOffset);
      if (!page || pageCount <= 0) return;
      const layout = getItemLayout(data, page - 1);
      if (!layout) return;
      const items = blocksByPage.get(page);
      let frac = 0;
      if (items && items.length) {
        const cs = items[0].block.charStart;
        const ce = items[items.length - 1].block.charEnd;
        if (ce > cs) frac = Math.max(0, Math.min(1, (charOffset - cs) / (ce - cs)));
      }
      const target = Math.max(0, layout.offset + frac * layout.length - 100);
      listRef.current?.scrollToOffset({ offset: target, animated });
    },
    [pageForOffset, pageCount, getItemLayout, data, blocksByPage],
  );

  const toggleFollow = useCallback(() => {
    setFollowMode((on) => {
      const next = !on;
      // Re-enabling jumps back to wherever the reading currently is.
      if (next && activeChunk) scrollToReadingOffset(activeChunk.charStart, true);
      return next;
    });
  }, [activeChunk, scrollToReadingOffset]);

  // Tapping a contents entry is ambiguous (navigate vs. read), so open a themed
  // dialog: jump to the section, or select its text like any sentence.
  const promptTocAction = useCallback((title: string, target: number, charStart: number) => {
    setTocPrompt({ title, target, charStart });
  }, []);

  const tocActions = useMemo<DialogAction[]>(() => {
    if (!tocPrompt) return [];
    const a: DialogAction[] = [];
    if (!Number.isNaN(tocPrompt.target)) {
      a.push({ label: `Jump to page ${tocPrompt.target}`, variant: 'filled', onPress: () => scrollToPage(tocPrompt.target, false) });
    }
    a.push({ label: 'Select text', variant: 'tonal', onPress: () => playback.select(tocPrompt.charStart) });
    a.push({ label: 'Cancel', variant: 'ghost' });
    return a;
  }, [tocPrompt, scrollToPage, playback]);

  // Follow mode: when on, keep the playing/selected chunk in view as it advances.
  // Reads currentPage via a ref so the user's own scrolling doesn't retrigger
  // this — only a chunk change does.
  const activeOffset = activeChunk?.charStart ?? -1;
  useEffect(() => {
    if (!followMode || activeOffset < 0 || pageCount <= 0) return;
    scrollToReadingOffset(activeOffset, true);
  }, [followMode, activeOffset, pageCount, scrollToReadingOffset]);

  // Persist the reading position (char offset of the current chunk) so the
  // library's "Continue" can resume it.
  const currentCharStart = playback.currentChunk?.charStart ?? -1;
  useEffect(() => {
    if (doc && playback.engaged && currentCharStart >= 0) setCursor(doc.docHash, currentCharStart);
  }, [doc?.docHash, playback.engaged, currentCharStart, setCursor]);

  // Resume the saved position once, when the text is ready (highlight + follow,
  // no auto-play — the user presses play to continue).
  const resumedRef = useRef(false);
  useEffect(() => {
    if (status !== 'ready' || !doc || resumedRef.current) return;
    resumedRef.current = true;
    const saved = useDocumentsStore.getState().cursor[doc.docHash];
    if (saved != null && saved > 0) playback.goTo(saved);
  }, [status, doc?.docHash, playback]);

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
    if (b.kind === 'pageHeader') {
      // Running header/footer — greyed, receded, and separated by a rule. Not
      // spoken, so it isn't tappable/selectable like body text.
      return (
        <View key={gbi} style={styles.pageHeader}>
          <Text numberOfLines={1} style={ty(TYPE.caption, p.textDim)}>{b.text}</Text>
        </View>
      );
    }
    if (b.kind === 'h2') {
      return <Text key={gbi} style={[ty(TYPE.titleSerif, p.text), styles.heading, pad]}>{b.text}</Text>;
    }
    if (b.kind === 'toc') {
      const target = b.target ? parseInt(b.target, 10) : NaN;
      return (
        <Pressable key={gbi} onPress={() => promptTocAction(b.title, target, b.charStart)} style={[styles.tocRow, pad]}>
          <Text style={[ty(TYPE.body, p.text), styles.tocTitle]}>{renderTocTitle(b.title, p.primary)}</Text>
          <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.tocLeader, { color: p.textDim }]}>{TOC_DOTS}</Text>
          {b.target ? <Text style={ty(TYPE.label, p.primary)}>{b.target}</Text> : null}
        </Pressable>
      );
    }
    // Whole paragraph is the tap target (incl. line gaps + the trailing-margin
    // gap) so taps that land off a glyph still select the right sentence; a tap
    // outside any sentence falls back to the paragraph's first sentence.
    return (
      <Pressable key={gbi} onPress={() => handleSentenceTap(b.sentences[0]?.charStart ?? b.charStart)} style={pad}>
        <Text style={ty(TYPE.reader, p.text)}>
          {b.sentences.map((s, si) => {
            // Accent highlight = playing/selected chunk; gray = a pending tap made
            // while audio is playing; dim = already read.
            const isCurrent = !!activeChunk && s.charStart >= activeChunk.charStart && s.charStart < activeChunk.charEnd;
            const isPending = !!pendingChunk && s.charStart >= pendingChunk.charStart && s.charStart < pendingChunk.charEnd;
            const isRead = !!activeChunk && s.charStart < activeChunk.charStart;
            const color = isCurrent ? p.highlightInk : isRead ? p.textMuted : p.text;
            const bg = isCurrent ? p.highlight : isPending ? p.surfaceAlt : 'transparent';
            return (
              <Text key={si} onPress={() => handleSentenceTap(s.charStart)} style={{ color, backgroundColor: bg }}>
                {s.text}{si < b.sentences.length - 1 ? ' ' : ''}
              </Text>
            );
          })}
        </Text>
      </Pressable>
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

      <View style={styles.body} onTouchStart={showHint ? dismissHint : undefined}>
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
              extraData={`${loadedPages}:${geomVersion}:${activeChunk?.charStart ?? -1}:${pendingChunk?.charStart ?? -1}`}
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
        {showHint ? <TapHint onClose={dismissHint} /> : null}
      </View>

      {hasPages ? (
        <View style={styles.pageBar}>
          <Chip label="Follow" selected={followMode} onPress={toggleFollow} />
          <Text style={ty(TYPE.label, p.textMuted)}>
            Page {currentPage} / {pageCount}
            {status === 'streaming' ? `  ·  ${loadedPages} loaded` : ''}
          </Text>
          <View style={styles.pageNav}>
            <IconButton icon="back" onPress={() => scrollToPage(currentPage - 1)} accessibilityLabel="Previous page" />
            <IconButton icon="chevR" onPress={() => scrollToPage(currentPage + 1)} accessibilityLabel="Next page" />
          </View>
        </View>
      ) : null}

      <PlayerControls
        playing={playback.playing}
        loading={playback.loading}
        onTogglePlay={onTogglePlay}
        onSkipBack={playback.previous}
        onSkipFwd={playback.next}
        progress={playback.durationSec > 0 ? playback.positionSec / playback.durationSec : 0}
        onScrub={playback.seek}
        position={formatTime(playback.positionSec)}
        duration={formatTime(Math.max(0, playback.durationSec - playback.positionSec))}
        speed={effSpeed}
        onSpeed={() => setSpeedSheet(true)}
        voiceName={voiceLabel(effVoiceId)}
      />

      <Sheet open={speedSheet} onClose={() => setSpeedSheet(false)} title="Playback speed" heightRatio={0.42}>
        <View style={styles.sheetBody}>
          <Text style={[ty(TYPE.display, p.text), styles.speedValue]}>×{effSpeed.toFixed(2)}</Text>
          <Slider value={effSpeed} min={0.9} max={1.5} step={0.05} onChange={setEffSpeed} ticks={[0.9, 1.0, 1.05, 1.25, 1.5]} />
          <View style={styles.sliderLabels}>
            <Text style={ty(TYPE.mono, p.textMuted)}>0.90</Text>
            <Text style={ty(TYPE.mono, p.textMuted)}>1.50</Text>
          </View>
          <View style={styles.presetRow}>
            {SPEED_PRESETS.map((v) => (
              <Chip key={v} label={`×${v.toFixed(2)}`} selected={Math.abs(effSpeed - v) < 0.01} onPress={() => setEffSpeed(v)} />
            ))}
          </View>
        </View>
      </Sheet>

      <ActionDialog
        open={!!tocPrompt}
        onClose={() => setTocPrompt(null)}
        title={tocPrompt?.title}
        message="This is a contents entry. Jump to its section, or select the text to read from here."
        actions={tocActions}
      />

      <ActionDialog
        open={playPrompt}
        onClose={clearPending}
        title="Jump here?"
        message="Audio is still playing. Start reading from the tapped sentence, or keep playing where you are."
        actions={[
          { label: 'Play from here', variant: 'filled', onPress: () => { if (pendingOffset != null) playback.playFrom(pendingOffset); } },
          { label: 'Keep playing', variant: 'ghost' },
        ]}
      />

      {extractor}
    </View>
  );
}
