import { useMemo } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import type { VoiceGender } from '../../types';
import { makeStyles } from './VoiceSwatch.styles';

const HUES_F = ['#d9a39a', '#c79e8e', '#cbb39e', '#d6b39a', '#caa28a'];
const HUES_M = ['#8a9ba8', '#9aa39a', '#a8a092', '#92a3a3', '#a3958a'];
const BARS = [3, 7, 5, 9, 6, 8, 4];

export type VoiceSwatchProps = { idx: number; gender: VoiceGender };

// Decorative voice avatar — a tinted tile with a tiny waveform.
export function VoiceSwatch({ idx, gender }: VoiceSwatchProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const hues = gender === 'f' ? HUES_F : HUES_M;
  const bg = hues[idx % hues.length];
  return (
    <View style={[styles.base, { backgroundColor: bg }]}>
      {BARS.map((h, i) => (
        <View key={i} style={{ width: 2.5, height: h * 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.85)' }} />
      ))}
    </View>
  );
}
