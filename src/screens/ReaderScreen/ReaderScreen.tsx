import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppBar, Chip, Icon, IconButton, PlayerControls, Sheet, Slider, TapHint } from '../../components';
import { elevation, ty, TYPE, useTheme } from '../../theme';
import type { PageBlock } from '../../types';
import { flatSentenceIndex } from './flatSentenceIndex';
import { makeStyles } from './ReaderScreen.styles';

const SPEED_PRESETS = [0.9, 1.0, 1.05, 1.15, 1.25, 1.5];

type ReaderScreenProps = {
  title?: string;
  subtitle?: string;
  blocks?: PageBlock[];
  pageLabel?: string;
  voiceName?: string;
  positionLabel?: string;
  durationLabel?: string;
  initialSpeed?: number;
  onBack?: () => void;
};

// Presentational reader. Content + playback labels arrive via props (empty
// until wired to the PDF.js bridge + TTS engine); local state drives the
// interactive controls.
export default function ReaderScreen({
  title,
  subtitle,
  blocks = [],
  pageLabel,
  voiceName = '',
  positionLabel = '0:00',
  durationLabel = '0:00',
  initialSpeed = 1.05,
  onBack,
}: ReaderScreenProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(initialSpeed);
  const [speedSheet, setSpeedSheet] = useState(false);

  const flat = useMemo(() => flatSentenceIndex(blocks), [blocks]);
  const total = flat.length;
  const hasContent = blocks.length > 0;

  return (
    <View style={styles.screen}>
      <AppBar onBack={onBack} title={title} subtitle={subtitle} actions={<IconButton icon="more" accessibilityLabel="More" />} />

      <View style={styles.body}>
        {hasContent ? (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={[styles.card, elevation(1)]}>
              {pageLabel ? <Text style={[ty(TYPE.caption, p.textDim), styles.pageLabel]}>{pageLabel}</Text> : null}
              {blocks.map((b, bi) => {
                if (b.kind === 'h2') {
                  return <Text key={bi} style={[ty(TYPE.titleSerif, p.text), styles.heading]}>{b.text}</Text>;
                }
                return (
                  <Text key={bi} style={[ty(TYPE.reader, p.text), styles.paragraph]}>
                    {b.sentences.map((s, si) => {
                      const flatIdx = flat.findIndex((x) => x.bi === bi && x.si === si);
                      const isCurrent = flatIdx === current && playing;
                      const color = isCurrent ? p.highlightInk : playing && flatIdx < current ? p.textMuted : p.text;
                      return (
                        <Text key={si} onPress={() => { setCurrent(flatIdx); setPlaying(true); }} style={{ color, backgroundColor: isCurrent ? p.highlight : 'transparent' }}>
                          {s}{si < b.sentences.length - 1 ? ' ' : ''}
                        </Text>
                      );
                    })}
                  </Text>
                );
              })}
            </View>
          </ScrollView>
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
        position={positionLabel}
        duration={durationLabel}
        speed={speed}
        onSpeed={() => setSpeedSheet(true)}
        voiceName={voiceName}
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
    </View>
  );
}
