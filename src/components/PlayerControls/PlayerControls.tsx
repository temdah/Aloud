import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { elevation, ty, TYPE, useTheme } from '../../theme';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import { ProcessingRing } from '../ProcessingRing';
import { Slider } from '../Slider';
import { makeStyles } from './PlayerControls.styles';

export type PlayerControlsProps = {
  playing: boolean;
  loading?: boolean;
  onTogglePlay: () => void;
  onStop?: () => void;
  onSkipBack: () => void;
  onSkipFwd: () => void;
  progress: number;
  onScrub: (value: number) => void; // fired on release (fraction 0..1)
  totalSec: number; // for the live preview label while dragging
  position: string;
  duration: string;
  speed: number;
  onSpeed: () => void;
  onSleep: () => void;
  sleepMinutesLeft?: number | null;
};

function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function PlayerControls({
  playing, loading = false, onTogglePlay, onStop, onSkipBack, onSkipFwd,
  progress, onScrub, totalSec, position, duration, speed, onSpeed, onSleep, sleepMinutesLeft = null,
}: PlayerControlsProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  // Show where the thumb will land while dragging; seek only on release.
  const [preview, setPreview] = useState<number | null>(null);
  const posLabel = preview != null ? fmtTime(preview * totalSec) : position;
  const remLabel = preview != null ? fmtTime(Math.max(0, totalSec - preview * totalSec)) : duration;
  return (
    <View style={[styles.container, elevation(2)]}>
      <Slider
        value={progress}
        onChange={(f) => setPreview(f)}
        onCommit={(f) => {
          setPreview(null);
          onScrub(f);
        }}
        height={20}
      />
      <View style={styles.timeRow}>
        <Text style={ty(TYPE.mono, p.textMuted)}>{posLabel}</Text>
        <Text style={ty(TYPE.mono, p.textMuted)}>-{remLabel}</Text>
      </View>
      <View style={styles.controlRow}>
        <View style={styles.leftCluster}>
          <Pressable
            onPress={onSleep}
            accessibilityRole="button"
            accessibilityLabel="Sleep timer"
            style={styles.sleepButton}
          >
            <Icon name="moon" size={20} color={sleepMinutesLeft != null ? p.primary : p.textMuted} />
            {sleepMinutesLeft != null ? (
              <Text style={ty(TYPE.label, p.primary)}>{sleepMinutesLeft}m</Text>
            ) : null}
          </Pressable>
          {onStop ? <IconButton icon="stop" onPress={onStop} size={36} accessibilityLabel="Stop" /> : null}
        </View>
        <IconButton icon="skipBack" onPress={onSkipBack} size={44} accessibilityLabel="Skip back" />
        <View style={styles.playWrap}>
          <ProcessingRing active={loading} />
          <Pressable
            onPress={onTogglePlay}
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause' : 'Play'}
            style={[styles.playButton, elevation(2)]}
          >
            <Icon name={playing ? 'pause' : 'play'} size={26} color={p.onPrimary} />
          </Pressable>
        </View>
        <IconButton icon="skipFwd" onPress={onSkipFwd} size={44} accessibilityLabel="Skip forward" />
        <Pressable onPress={onSpeed} accessibilityRole="button" accessibilityLabel="Playback speed" style={styles.speedButton}>
          <Text style={ty(TYPE.label, p.textMuted)}>×</Text>
          <Text style={ty(TYPE.label, p.text)}>{speed.toFixed(2)}</Text>
        </Pressable>
      </View>
    </View>
  );
}
