import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { elevation, ty, TYPE, useTheme } from '../../theme';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import { Slider } from '../Slider';
import { makeStyles } from './PlayerControls.styles';

export type PlayerControlsProps = {
  playing: boolean;
  onTogglePlay: () => void;
  onSkipBack: () => void;
  onSkipFwd: () => void;
  progress: number;
  onScrub: (value: number) => void;
  position: string;
  duration: string;
  speed: number;
  onSpeed: () => void;
  voiceName: string;
};

export function PlayerControls({
  playing, onTogglePlay, onSkipBack, onSkipFwd,
  progress, onScrub, position, duration, speed, onSpeed, voiceName,
}: PlayerControlsProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  return (
    <View style={[styles.container, elevation(2)]}>
      <Slider value={progress} onChange={onScrub} height={20} />
      <View style={styles.timeRow}>
        <Text style={ty(TYPE.mono, p.textMuted)}>{position}</Text>
        <Text style={ty(TYPE.mono, p.textMuted)}>-{duration}</Text>
      </View>
      <View style={styles.controlRow}>
        <View style={styles.voiceWrap}>
          <Icon name="voice" size={16} color={p.textMuted} />
          <Text numberOfLines={1} style={ty(TYPE.bodySmall, p.textMuted)}>{voiceName}</Text>
        </View>
        <IconButton icon="skipBack" onPress={onSkipBack} size={44} accessibilityLabel="Skip back" />
        <Pressable
          onPress={onTogglePlay}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause' : 'Play'}
          style={[styles.playButton, elevation(2)]}
        >
          <Icon name={playing ? 'pause' : 'play'} size={26} color={p.onPrimary} />
        </Pressable>
        <IconButton icon="skipFwd" onPress={onSkipFwd} size={44} accessibilityLabel="Skip forward" />
        <Pressable onPress={onSpeed} accessibilityRole="button" accessibilityLabel="Playback speed" style={styles.speedButton}>
          <Text style={ty(TYPE.label, p.textMuted)}>×</Text>
          <Text style={ty(TYPE.label, p.text)}>{speed.toFixed(2)}</Text>
        </Pressable>
      </View>
    </View>
  );
}
