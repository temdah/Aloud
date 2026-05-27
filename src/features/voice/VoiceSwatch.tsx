import { View } from 'react-native';
import { useTheme } from '../../theme';
import type { VoiceGender } from './voiceTypes';

const HUES_F = ['#d9a39a', '#c79e8e', '#cbb39e', '#d6b39a', '#caa28a'];
const HUES_M = ['#8a9ba8', '#9aa39a', '#a8a092', '#92a3a3', '#a3958a'];
const BARS = [3, 7, 5, 9, 6, 8, 4];

type VoiceSwatchProps = { idx: number; gender: VoiceGender };

// Decorative voice avatar — a tinted tile with a tiny waveform.
export function VoiceSwatch({ idx, gender }: VoiceSwatchProps) {
  const { palette: p } = useTheme();
  const hues = gender === 'f' ? HUES_F : HUES_M;
  const bg = hues[idx % hues.length];
  return (
    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: bg, borderWidth: 1, borderColor: p.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      {BARS.map((h, i) => (
        <View key={i} style={{ width: 2.5, height: h * 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.85)' }} />
      ))}
    </View>
  );
}
