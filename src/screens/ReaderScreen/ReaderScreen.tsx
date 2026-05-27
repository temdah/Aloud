import { useNavigation, useRoute } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppBar, Chip, Icon, IconButton, PlayerControls, Sheet, Slider, Spinner, TapHint, voiceLabel } from '../../components';
import { usePdfText } from '../../hooks';
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

// Reader for one document. PDF.js extracts the text (headless), which is shown
// as reflowed, tappable sentences. Playback wiring (tap-to-start, highlight
// synced to audio) is added in the next run; controls are presentational here.
export default function ReaderScreen() {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const navigation = useNavigation<AppNavigation>();
  const route = useRoute<ReaderRoute>();
  const doc = useDocumentsStore((s) => s.documents.find((d) => d.docHash === route.params.docId));
  const voiceId = useSettingsStore((s) => s.voiceId);
  const settingsSpeed = useSettingsStore((s) => s.speed);

  const { status, document, stage, error, extractor } = usePdfText(doc);

  const blocks = document?.blocks ?? [];

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(settingsSpeed);
  const [speedSheet, setSpeedSheet] = useState(false);

  const flat = useMemo(() => flatSentenceIndex(blocks), [blocks]);
  const total = flat.length;
  const hasContent = blocks.length > 0;
  const subtitle = document && document.pageCount > 0 ? `${document.pageCount} page${document.pageCount === 1 ? '' : 's'}` : undefined;

  return (
    <View style={styles.screen}>
      <AppBar onBack={() => navigation.goBack()} title={doc?.title} subtitle={subtitle} actions={<IconButton icon="more" accessibilityLabel="More" />} />

      <View style={styles.body}>
        {status === 'extracting' ? (
          <View style={styles.emptyState}>
            <Spinner size={26} color={p.primary} />
            <Text style={[ty(TYPE.body, p.textMuted), styles.emptyText]}>Reading the document…</Text>
            {stage ? <Text style={ty(TYPE.caption, p.textDim)}>{stage}</Text> : null}
          </View>
        ) : status === 'error' ? (
          <View style={styles.emptyState}>
            <Icon name="book" size={40} color={p.textDim} />
            <Text style={[ty(TYPE.body, p.textMuted), styles.emptyText]}>Couldn’t read this PDF.</Text>
            {error ? <Text style={ty(TYPE.caption, p.textDim)}>{error}</Text> : null}
          </View>
        ) : hasContent ? (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={[styles.card, elevation(1)]}>
              {blocks.map((b, bi) => {
                const pad = { paddingLeft: b.indent * INDENT_STEP };
                if (b.kind === 'h2') {
                  return <Text key={bi} style={[ty(TYPE.titleSerif, p.text), styles.heading, pad]}>{b.text}</Text>;
                }
                if (b.kind === 'toc') {
                  return (
                    <View key={bi} style={[styles.tocRow, pad]}>
                      <Text style={[ty(TYPE.body, p.text), styles.tocTitle]}>{renderTocTitle(b.title, p.primary)}</Text>
                      <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.tocLeader, { color: p.textDim }]}>{TOC_DOTS}</Text>
                      {b.target ? <Text style={ty(TYPE.label, p.primary)}>{b.target}</Text> : null}
                    </View>
                  );
                }
                return (
                  <Text key={bi} style={[ty(TYPE.reader, p.text), styles.paragraph, pad]}>
                    {b.sentences.map((s, si) => {
                      const flatIdx = flat.findIndex((x) => x.bi === bi && x.si === si);
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
              })}
            </View>
          </ScrollView>
        ) : status === 'ready' ? (
          <View style={styles.emptyState}>
            <Icon name="book" size={40} color={p.textDim} />
            <Text style={[ty(TYPE.body, p.textMuted), styles.emptyText]}>No selectable text found.</Text>
            <Text style={ty(TYPE.caption, p.textDim)}>This PDF may be scanned images.</Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Icon name="book" size={40} color={p.textDim} />
            <Text style={[ty(TYPE.body, p.textMuted), styles.emptyText]}>No document open.</Text>
          </View>
        )}
        {hasContent && !playing && current === 0 ? <TapHint /> : null}
      </View>

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
