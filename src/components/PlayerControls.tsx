import { Pressable, Text, View } from 'react-native';
import { elevation, ty, TYPE, useTheme } from '../theme';
import type { PlayerControlsProps } from './componentTypes';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Slider } from './Slider';

export function PlayerControls({
  playing, onTogglePlay, onSkipBack, onSkipFwd,
  progress, onScrub, position, duration, speed, onSpeed, voiceName,
}: PlayerControlsProps) {
  const { palette: p } = useTheme();
  return (
    <View style={[{ backgroundColor: p.surface, borderTopWidth: 1, borderTopColor: p.border, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 }, elevation(2)]}>
      <Slider value={progress} onChange={onScrub} height={20} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2, marginBottom: 6 }}>
        <Text style={ty(TYPE.mono, p.textMuted)}>{position}</Text>
        <Text style={ty(TYPE.mono, p.textMuted)}>-{duration}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <Icon name="voice" size={16} color={p.textMuted} />
          <Text numberOfLines={1} style={ty(TYPE.bodySmall, p.textMuted)}>{voiceName}</Text>
        </View>
        <IconButton icon="skipBack" onPress={onSkipBack} size={44} accessibilityLabel="Skip back" />
        <Pressable
          onPress={onTogglePlay}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause' : 'Play'}
          style={[{ width: 56, height: 56, borderRadius: 28, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center' }, elevation(2)]}
        >
          <Icon name={playing ? 'pause' : 'play'} size={26} color={p.onPrimary} />
        </Pressable>
        <IconButton icon="skipFwd" onPress={onSkipFwd} size={44} accessibilityLabel="Skip forward" />
        <Pressable onPress={onSpeed} accessibilityRole="button" accessibilityLabel="Playback speed" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
          <Text style={ty(TYPE.label, p.textMuted)}>×</Text>
          <Text style={ty(TYPE.label, p.text)}>{speed.toFixed(2)}</Text>
        </Pressable>
      </View>
    </View>
  );
}
