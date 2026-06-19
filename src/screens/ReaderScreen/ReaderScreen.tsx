import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View, type ViewToken } from 'react-native';
import { ActionDialog, AppBar, Chip, Icon, IconButton, LanguagePicker, ManageCacheSheet, PageScrubber, PlayerControls, Sheet, Slider, Spinner, TapHint, VoicePicker, voiceLabel, type DialogAction } from '../../components';
import { usePageGeometry, usePdfText } from '../../hooks';
import { File } from 'expo-file-system';
import { usePlaybackContext } from '../../playback';
import type { ExtractedBlock } from '../../pdf';
import { deleteExtractedText } from '../../pdf/extractedTextCache';
import { useDocumentsStore, useSettingsStore } from '../../stores';
import { clearDocumentCache, findModel, isChunkCached, languageLabel, loadChunks } from '../../supertonic';
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
  const setProgress = useDocumentsStore((s) => s.setProgress);
  const renderProfile = useDocumentsStore((s) => s.renderProfile[route.params.docId]);
  const setRenderProfile = useDocumentsStore((s) => s.setRenderProfile);
  const favourites = useDocumentsStore((s) => s.favourites);
  const toggleFavourite = useDocumentsStore((s) => s.toggleFavourite);
  const removeDocument = useDocumentsStore((s) => s.removeDocument);
  const clearAudiobook = useDocumentsStore((s) => s.clearAudiobook);
  const audiobook = useDocumentsStore((s) => s.audiobook[route.params.docId]);
  const setDocLang = useDocumentsStore((s) => s.setDocLang);
  const modelId = useSettingsStore((s) => s.modelId);
  const voiceId = useSettingsStore((s) => s.voiceId);
  const setVoice = useSettingsStore((s) => s.setVoice);
  const settingsLang = useSettingsStore((s) => s.lang);
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
  // Language precedence: a pinned full-audiobook render wins (its cache was made
  // in that language); otherwise the per-document override; otherwise the global
  // default. Keeps tap-to-start reading the right cache.
  const effLang = renderProfile?.lang ?? doc?.lang ?? settingsLang ?? 'en';
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

  // Playback now lives in a global provider so audio + transport survive leaving
  // this screen (mini player on other screens). The Reader registers the open
  // document with the engine; consuming `playback` works exactly as before.
  const { playback, activeDoc, setActiveDoc, clearActiveDoc, sleep } = usePlaybackContext();
  useEffect(() => {
    if (status !== 'ready' || !doc || !document?.text) return;
    setActiveDoc({ doc, chunks, text: document.text, modelId: effModelId, voiceId: effVoiceId, speed: effSpeed, steps: effSteps, lang: effLang, onSpeedChange: setEffSpeed });
  }, [status, doc, document?.text, chunks, effModelId, effVoiceId, effSpeed, effSteps, effLang, setActiveDoc, setEffSpeed]);

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
  const [menu, setMenu] = useState(false);
  const [sleepMenu, setSleepMenu] = useState(false);
  const [voiceSheet, setVoiceSheet] = useState(false);
  const [langSheet, setLangSheet] = useState(false);
  const [manageSheet, setManageSheet] = useState(false);
  // A voice the user picked that needs confirmation because switching it would
  // bypass already-cached audio (held until they confirm in the dialog).
  const [pendingVoice, setPendingVoice] = useState<string | null>(null);
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

  const isFavourite = doc ? favourites.includes(doc.docHash) : false;

  // Delete the open document (and all its cache) from the reader's overflow
  // menu, halting playback first if this is the doc currently playing, then
  // leaving the now-empty reader.
  const deleteDocument = useCallback(() => {
    if (!doc) return;
    if (activeDoc?.doc.docHash === doc.docHash) {
      playback.stop();
      clearActiveDoc();
    }
    clearDocumentCache(doc.docHash);
    clearAudiobook(doc.docHash);
    deleteExtractedText(doc.docHash);
    try {
      new File(doc.fileUri).delete();
    } catch {}
    removeDocument(doc.docHash);
    navigation.goBack();
  }, [doc, activeDoc, playback, clearActiveDoc, clearAudiobook, removeDocument, navigation]);

  // Apply a voice change for real. When a full-audiobook profile is pinned, the
  // reader always reads through that profile, so we must repoint it at the new
  // voice (and forget the now-stale "done" render so the cache isn't treated as
  // complete); otherwise we just move the global voice. Either way the effVoiceId
  // change re-registers the active document, so playback picks up the new voice.
  const applyVoice = useCallback(
    (newVoice: string) => {
      if (!doc) return;
      if (renderProfile) {
        setRenderProfile(doc.docHash, { ...renderProfile, voiceId: newVoice });
        if (audiobook?.status === 'done') clearAudiobook(doc.docHash);
      } else {
        setVoice(newVoice);
      }
      setPendingVoice(null);
    },
    [doc, renderProfile, setRenderProfile, audiobook?.status, clearAudiobook, setVoice],
  );

  // Voice picked in the sheet. If the document already has cached audio for the
  // current voice (per-chunk or a full audiobook), switching means that cache is
  // kept but bypassed and new audio is generated — so we confirm first. With no
  // cache to bypass, switch immediately.
  const onVoiceChange = useCallback(
    (newVoice: string) => {
      if (!doc || newVoice === effVoiceId) return;
      const cached =
        audiobook?.status === 'done' ||
        (chunks.length > 0 &&
          isChunkCached(doc.docHash, chunks[0].charStart, {
            modelId: effModelId ?? '',
            voiceId: effVoiceId,
            speed: effSpeed,
            steps: effSteps,
            lang: effLang,
          }));
      if (cached) {
        setVoiceSheet(false);
        setPendingVoice(newVoice);
      } else {
        applyVoice(newVoice);
      }
    },
    [doc, effVoiceId, audiobook?.status, chunks, effModelId, effSpeed, effSteps, effLang, applyVoice],
  );

  const menuActions: DialogAction[] = doc
    ? [
        {
          label: isFavourite ? 'Remove from favourites' : 'Add to favourites',
          variant: 'tonal',
          onPress: () => toggleFavourite(doc.docHash),
        },
        {
          label: `Change voice · ${voiceLabel(effVoiceId)}`,
          variant: 'tonal',
          onPress: () => (effModelId ? setVoiceSheet(true) : navigation.navigate('VoiceModel')),
        },
        {
          label: `Language · ${languageLabel(effLang)}`,
          variant: 'tonal',
          onPress: () => (effModelId ? setLangSheet(true) : navigation.navigate('VoiceModel')),
        },
        {
          label: 'Make full audiobook',
          variant: 'tonal',
          onPress: () => navigation.navigate('Prerender', { docId: doc.docHash }),
        },
        {
          label: 'Manage cached audio',
          variant: 'tonal',
          onPress: () => setManageSheet(true),
        },
        { label: 'Delete', variant: 'danger', onPress: deleteDocument },
        { label: 'Cancel', variant: 'ghost' },
      ]
    : [];

  const sleepActions: DialogAction[] = [
    ...[15, 30, 45, 60].map((m) => ({
      label: `${m} minutes`,
      variant: 'tonal' as const,
      onPress: () => sleep.start(m),
    })),
    ...(sleep.active ? [{ label: 'Turn off', variant: 'danger' as const, onPress: sleep.cancel }] : []),
    { label: 'Cancel', variant: 'ghost' as const },
  ];

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
  const totalChars = document?.text?.length ?? 0;
  useEffect(() => {
    if (doc && playback.engaged && currentCharStart >= 0) {
      setCursor(doc.docHash, currentCharStart);
      if (totalChars > 0) setProgress(doc.docHash, currentCharStart / totalChars);
    }
  }, [doc?.docHash, playback.engaged, currentCharStart, totalChars, setCursor, setProgress]);

  // Resume the saved position once, when the text is ready (highlight + follow,
  // no auto-play — the user presses play to continue). Wait until the engine has
  // actually registered this document (so its chunks are loaded), and never
  // disturb a document that's already playing (returning to it from elsewhere).
  const resumedRef = useRef(false);
  useEffect(() => {
    if (status !== 'ready' || !doc || resumedRef.current) return;
    if (activeDoc?.doc.docHash !== doc.docHash) return; // engine not yet on this doc
    resumedRef.current = true;
    if (playback.engaged) return; // already playing this doc — leave it be
    const saved = useDocumentsStore.getState().cursor[doc.docHash];
    if (saved != null && saved > 0) playback.goTo(saved);
  }, [status, doc?.docHash, activeDoc?.doc.docHash, playback]);

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
      <AppBar onBack={() => navigation.goBack()} title={doc?.title} subtitle={pageCount > 0 ? `${pageCount} pages` : undefined} actions={<IconButton icon="more" accessibilityLabel="More" onPress={() => setMenu(true)} />} />

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
            <Text style={[ty(TYPE.body, p.textMuted), styles.emptyText]}>Couldn’t read this document.</Text>
            {error ? <Text style={ty(TYPE.caption, p.textDim)}>{error}</Text> : null}
          </View>
        ) : status === 'ready' && blocks.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="book" size={40} color={p.textDim} />
            <Text style={[ty(TYPE.body, p.textMuted), styles.emptyText]}>No selectable text found.</Text>
            <Text style={ty(TYPE.caption, p.textDim)}>{doc?.kind === 'pdf' || !doc?.kind ? 'This PDF may be scanned images.' : 'This file appears to be empty.'}</Text>
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
          <Chip label="Read along" selected={followMode} onPress={toggleFollow} />
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
        onStop={playback.stop}
        onSkipBack={playback.previous}
        onSkipFwd={playback.next}
        progress={
          playback.timelineReady && playback.docDurationSec > 0
            ? playback.docPositionSec / playback.docDurationSec
            : playback.durationSec > 0
              ? playback.positionSec / playback.durationSec
              : 0
        }
        onScrub={
          playback.timelineReady && playback.docDurationSec > 0
            ? (f) => playback.seekToTime(f * playback.docDurationSec)
            : playback.seek
        }
        position={formatTime(playback.timelineReady ? playback.docPositionSec : playback.positionSec)}
        duration={formatTime(
          Math.max(
            0,
            playback.timelineReady
              ? playback.docDurationSec - playback.docPositionSec
              : playback.durationSec - playback.positionSec,
          ),
        )}
        speed={effSpeed}
        onSpeed={() => setSpeedSheet(true)}
        onSleep={() => setSleepMenu(true)}
        sleepMinutesLeft={sleep.active ? sleep.minutesLeft : null}
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

      <Sheet open={voiceSheet} onClose={() => setVoiceSheet(false)} title="Reading voice" heightRatio={0.78}>
        <VoicePicker value={effVoiceId} onChange={onVoiceChange} modelId={effModelId} lang={effLang} />
      </Sheet>

      <Sheet open={langSheet} onClose={() => setLangSheet(false)} title="Language" heightRatio={0.78}>
        <LanguagePicker
          value={doc?.lang ?? null}
          onChange={(code) => {
            if (doc) setDocLang(doc.docHash, code);
            setLangSheet(false);
          }}
          onUseDefault={() => {
            if (doc) setDocLang(doc.docHash, null);
            setLangSheet(false);
          }}
          defaultLabel={languageLabel(settingsLang)}
          langCodes={findModel(effModelId)?.langCodes ?? []}
        />
      </Sheet>

      <ManageCacheSheet
        open={manageSheet}
        onClose={() => setManageSheet(false)}
        docHash={doc?.docHash ?? null}
        title={doc?.title}
      />

      <ActionDialog
        open={pendingVoice != null}
        onClose={() => setPendingVoice(null)}
        title="Change voice?"
        message={
          pendingVoice
            ? `This document already has audio cached for ${voiceLabel(effVoiceId)}. That cache is kept but won't be used — new audio is generated with ${voiceLabel(pendingVoice)} as you play.`
            : undefined
        }
        actions={[
          { label: pendingVoice ? `Use ${voiceLabel(pendingVoice)}` : 'Change', variant: 'filled', onPress: () => { if (pendingVoice) applyVoice(pendingVoice); } },
          { label: 'Keep current voice', variant: 'ghost' },
        ]}
      />

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

      <ActionDialog open={menu} onClose={() => setMenu(false)} title={doc?.title} actions={menuActions} />

      <ActionDialog
        open={sleepMenu}
        onClose={() => setSleepMenu(false)}
        title="Sleep timer"
        message={sleep.active ? `Pausing in about ${sleep.minutesLeft} min.` : 'Pause playback after…'}
        actions={sleepActions}
      />

      {extractor}
    </View>
  );
}
