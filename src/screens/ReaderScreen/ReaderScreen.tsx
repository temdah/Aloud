import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { AppBar, IconButton, PerfTips, PlayerControls, ReaderContent, ReaderOverlays, voiceLabel, type DialogAction } from '../../components';
import { usePageGeometry, usePdfText } from '../../hooks';
import { usePlaybackContext } from '../../playback';
import type { ExtractedBlock } from '../../pdf';
import { deleteDocument as deleteDocumentData } from '../../services';
import { useDocumentsStore, useSettingsStore } from '../../stores';
import { deleteModel, EMPTY_NARRATION_PLAN, isChunkCached, languageLabel, loadNarrationPlan, qualityProfile } from '../../supertonic';
import { useTheme } from '../../theme';
import { findBlockForOffset, type IndexedOffsetRange } from '../../utils';
import type { AppNavigation, ReaderRoute } from '../../navigation';
import { makeStyles } from './ReaderScreen.styles';

const PERF_TIP_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}


// The reader: paginated text with tap-to-start, sentence highlighting, follow
// mode, page scrubbing, and the full transport (speed/voice/language/sleep).
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
  const quality = useSettingsStore((s) => s.quality);
  const tone = useSettingsStore((s) => s.tone);
  const perfTipSuppressed = useSettingsStore((s) => s.perfTipSuppressed);
  const perfTipLastShown = useSettingsStore((s) => s.perfTipLastShown);
  const suppressPerfTip = useSettingsStore((s) => s.suppressPerfTip);
  const markPerfTipShown = useSettingsStore((s) => s.markPerfTipShown);

  // A rendered audiobook pins the settings used by its cache.
  const effModelId = renderProfile?.modelId ?? modelId;
  const effVoiceId = renderProfile?.voiceId ?? voiceId;
  const effSteps = renderProfile?.steps ?? steps;
  const effLang = renderProfile?.lang ?? doc?.lang ?? settingsLang ?? 'en';
  const effSpeed = renderProfile?.speed ?? speed;
  const effQuality = renderProfile?.quality ?? quality;
  const effTone = renderProfile?.tone ?? tone;
  const setEffSpeed = useCallback(
    (v: number) => {
      if (renderProfile) setRenderProfile(route.params.docId, { ...renderProfile, speed: v });
      else setSpeed(v);
    },
    [renderProfile, setRenderProfile, route.params.docId, setSpeed],
  );

  const { status, document, pageCount, loadedPages, stage, error, extractor } = usePdfText(doc);

  const blocks = document?.blocks ?? [];
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

  // Canonical offsets join rendered sentences to cached audio.
  const narrationPlan = useMemo(
    () =>
      status === 'ready' && doc && document?.text
        ? loadNarrationPlan(doc.docHash, document.text, qualityProfile(effQuality).unitLen)
        : EMPTY_NARRATION_PLAN,
    [status, doc?.docHash, document?.text, effQuality],
  );
  const chunks = narrationPlan.chunks;

  const { playback, activeDoc, setActiveDoc, clearActiveDoc, sleep } = usePlaybackContext();
  const [modelErrorOpen, setModelErrorOpen] = useState(false);
  useEffect(() => {
    if (playback.modelLoadFailed) setModelErrorOpen(true);
  }, [playback.modelLoadFailed]);

  const [perfBanner, setPerfBanner] = useState(false);
  useEffect(() => {
    if (playback.perfWarning && !perfTipSuppressed && Date.now() - perfTipLastShown > PERF_TIP_COOLDOWN_MS) {
      setPerfBanner(true);
    }
  }, [playback.perfWarning, perfTipSuppressed, perfTipLastShown]);
  const dismissPerf = () => {
    setPerfBanner(false);
    markPerfTipShown();
  };
  useEffect(() => {
    if (status !== 'ready' || !doc || !document?.text) return;
    setActiveDoc({ doc, plan: narrationPlan, modelId: effModelId, voiceId: effVoiceId, speed: effSpeed, steps: effSteps, lang: effLang, quality: effQuality, tone: effTone, onSpeedChange: setEffSpeed });
  }, [status, doc, document?.text, narrationPlan, effModelId, effVoiceId, effSpeed, effSteps, effLang, effQuality, effTone, setActiveDoc, setEffSpeed]);

  const activeChunk = playback.engaged ? playback.currentChunk : null;
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
  const [pendingVoice, setPendingVoice] = useState<string | null>(null);
  const [tocPrompt, setTocPrompt] = useState<{ title: string; target: number; charStart: number } | null>(null);
  const [showHint, setShowHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [followMode, setFollowMode] = useState(true);
  const blockLayouts = useRef(new Map<number, {
    page: number;
    charStart: number;
    charEnd: number;
    y: number;
    height: number;
  }>());
  const [pendingOffset, setPendingOffset] = useState<number | null>(null);
  const [playPrompt, setPlayPrompt] = useState(false);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

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

  // Animated jumps smooth-scroll every page in between (stuttery on a big doc),
  // so far jumps (scrubber, TOC) pass animated=false.
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

  useEffect(() => {
    blockLayouts.current.clear();
  }, [doc?.docHash]);

  const readableBlocks = useMemo<IndexedOffsetRange<Extract<ExtractedBlock, { kind: 'h2' | 'p' }>>[]>(
    () => blocks.flatMap((block, globalIndex) =>
      block.kind === 'h2' || block.kind === 'p' ? [{ block, globalIndex }] : []),
    [blocks],
  );

  const blockForOffset = useCallback(
    (offset: number) => findBlockForOffset(readableBlocks, offset),
    [readableBlocks],
  );

  // Scroll to a char offset's approximate spot within its page (not the page
  // top), interpolating its fractional position among that page's blocks.
  const scrollToReadingOffset = useCallback(
    (charOffset: number, animated = true) => {
      const match = blockForOffset(charOffset);
      if (!match || pageCount <= 0) return;
      const page = match.block.page;
      const layout = getItemLayout(data, page - 1);
      if (!layout) return;
      const measured = blockLayouts.current.get(match.globalIndex);
      if (measured) {
        const length = Math.max(1, measured.charEnd - measured.charStart);
        const fraction = Math.max(0, Math.min(1, (charOffset - measured.charStart) / length));
        const target = Math.max(0, layout.offset + measured.y + fraction * measured.height - 100);
        listRef.current?.scrollToOffset({ offset: target, animated });
        return;
      }
      const items = blocksByPage.get(page);
      const first = items?.[0]?.block.charStart ?? match.block.charStart;
      const last = items?.[items.length - 1]?.block.charEnd ?? match.block.charEnd;
      const fraction = last > first ? Math.max(0, Math.min(1, (charOffset - first) / (last - first))) : 0;
      const target = Math.max(0, layout.offset + fraction * layout.length - 100);
      listRef.current?.scrollToOffset({ offset: target, animated });
    },
    [blockForOffset, pageCount, getItemLayout, data, blocksByPage],
  );

  const toggleFollow = useCallback(() => {
    setFollowMode((on) => {
      const next = !on;
      if (next && activeChunk) scrollToReadingOffset(activeChunk.charStart, true);
      return next;
    });
  }, [activeChunk, scrollToReadingOffset]);

  const disableFollow = useCallback(() => setFollowMode(false), []);

  const recordBlockLayout = useCallback((
    globalIndex: number,
    page: number,
    charStart: number,
    charEnd: number,
    y: number,
    height: number,
  ) => {
    blockLayouts.current.set(globalIndex, { page, charStart, charEnd, y, height });
  }, []);

  const isFavourite = doc ? favourites.includes(doc.docHash) : false;

  const deleteDocument = useCallback(() => {
    if (!doc) return;
    if (activeDoc?.doc.docHash === doc.docHash) {
      playback.stop();
      clearActiveDoc();
    }
    deleteDocumentData(doc);
    navigation.goBack();
  }, [doc, activeDoc, playback, clearActiveDoc, navigation]);

  // Changing a pinned voice invalidates a completed audiobook.
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

  // Confirm before bypassing audio already cached for the current voice.
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
            quality: effQuality,
            tone: effTone,
          }));
      if (cached) {
        setVoiceSheet(false);
        setPendingVoice(newVoice);
      } else {
        applyVoice(newVoice);
      }
    },
    [doc, effVoiceId, audiobook?.status, chunks, effModelId, effSpeed, effSteps, effLang, effQuality, effTone, applyVoice],
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

  // A contents entry is ambiguous (navigate vs. read), so prompt: jump or select.
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

  // Keep the active chunk in view as it advances (only a chunk change triggers
  // this — currentPage is read via ref so the user's own scrolling doesn't).
  const activeOffset = activeChunk?.charStart ?? -1;
  useEffect(() => {
    if (!followMode || activeOffset < 0 || pageCount <= 0) return;
    scrollToReadingOffset(activeOffset, true);
  }, [followMode, activeOffset, pageCount, scrollToReadingOffset]);

  const currentCharStart = playback.currentChunk?.charStart ?? -1;
  const totalChars = document?.text?.length ?? 0;
  useEffect(() => {
    if (doc && playback.engaged && currentCharStart >= 0) {
      setCursor(doc.docHash, currentCharStart);
      if (totalChars > 0) setProgress(doc.docHash, currentCharStart / totalChars);
    }
  }, [doc?.docHash, playback.engaged, currentCharStart, totalChars, setCursor, setProgress]);

  // Resume only after playback has registered this document, without auto-playing.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (status !== 'ready' || !doc || resumedRef.current) return;
    if (activeDoc?.doc.docHash !== doc.docHash) return; // engine not yet on this doc
    resumedRef.current = true;
    if (playback.engaged) return; // already playing this doc — leave it be
    const saved = useDocumentsStore.getState().cursor[doc.docHash];
    if (saved != null && saved > 0) playback.goTo(saved);
  }, [status, doc?.docHash, activeDoc?.doc.docHash, playback]);

  return (
    <View style={styles.screen}>
      <AppBar onBack={() => navigation.goBack()} title={doc?.title} subtitle={pageCount > 0 ? `${pageCount} pages` : undefined} actions={<IconButton icon="more" accessibilityLabel="More" onPress={() => setMenu(true)} />} />

      <ReaderContent
        listRef={listRef}
        status={status}
        stage={stage}
        error={error}
        documentKind={doc?.kind}
        blocksByPage={blocksByPage}
        data={data}
        pageCount={pageCount}
        loadedPages={loadedPages}
        geometryVersion={geomVersion}
        currentPage={currentPage}
        activeChunk={activeChunk}
        pendingChunk={pendingChunk}
        showHint={showHint}
        followMode={followMode}
        getItemLayout={getItemLayout}
        onPageLayout={onPageLayout}
        onPageChanged={setCurrentPage}
        onUserScroll={disableFollow}
        onBlockLayout={recordBlockLayout}
        onScrollToIndexFailed={onScrollToIndexFailed}
        onJumpToPage={scrollToPage}
        onToggleFollow={toggleFollow}
        onSentencePress={handleSentenceTap}
        onContentsPress={promptTocAction}
        onDismissHint={dismissHint}
      />

      <PerfTips
        visible={perfBanner}
        onDismiss={dismissPerf}
        onSuppress={() => {
          setPerfBanner(false);
          suppressPerfTip();
        }}
        onMakeAudiobook={() => {
          dismissPerf();
          navigation.navigate('Prerender', { docId: route.params.docId });
        }}
        onChangeVoice={() => {
          dismissPerf();
          navigation.navigate('VoiceModel');
        }}
        lighterVoiceHint={effModelId === 'supertonic-3' ? 'Use a lighter voice model' : undefined}
      />

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
        totalSec={playback.timelineReady ? playback.docDurationSec : playback.durationSec}
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

      <ReaderOverlays
        speedOpen={speedSheet}
        speed={effSpeed}
        onCloseSpeed={() => setSpeedSheet(false)}
        onChangeSpeed={setEffSpeed}
        voiceOpen={voiceSheet}
        voiceId={effVoiceId}
        modelId={effModelId}
        language={effLang}
        onCloseVoice={() => setVoiceSheet(false)}
        onChangeVoice={onVoiceChange}
        languageOpen={langSheet}
        documentLanguage={doc?.lang ?? null}
        defaultLanguage={settingsLang}
        onCloseLanguage={() => setLangSheet(false)}
        onChangeLanguage={(code) => {
          if (doc) setDocLang(doc.docHash, code);
          setLangSheet(false);
        }}
        onUseDefaultLanguage={() => {
          if (doc) setDocLang(doc.docHash, null);
          setLangSheet(false);
        }}
        cacheOpen={manageSheet}
        documentHash={doc?.docHash ?? null}
        documentTitle={doc?.title}
        onCloseCache={() => setManageSheet(false)}
        pendingVoice={pendingVoice}
        onClosePendingVoice={() => setPendingVoice(null)}
        onApplyPendingVoice={applyVoice}
        contentsPrompt={tocPrompt}
        contentsActions={tocActions}
        onCloseContents={() => setTocPrompt(null)}
        playPromptOpen={playPrompt}
        pendingOffset={pendingOffset}
        onClosePlayPrompt={clearPending}
        onPlayFrom={playback.playFrom}
        menuOpen={menu}
        menuActions={menuActions}
        onCloseMenu={() => setMenu(false)}
        playbackError={playback.error}
        onRetryPlayback={playback.retry}
        onStopPlayback={playback.stop}
        modelErrorOpen={modelErrorOpen}
        onCloseModelError={() => setModelErrorOpen(false)}
        onRedownloadModel={() => {
          if (effModelId) deleteModel(effModelId);
          navigation.navigate('VoiceModel');
        }}
        sleepOpen={sleepMenu}
        sleepActive={sleep.active}
        sleepMinutesLeft={sleep.minutesLeft}
        sleepActions={sleepActions}
        onCloseSleep={() => setSleepMenu(false)}
        extractor={extractor}
      />
    </View>
  );
}
