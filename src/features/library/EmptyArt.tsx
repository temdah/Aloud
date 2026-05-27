import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../theme';
import { BookCover } from './BookCover';

// Empty-library hero: three tilted covers behind dashed concentric rings.
export function EmptyArt() {
  const { palette: p } = useTheme();
  return (
    <View style={{ width: 220, height: 170, alignSelf: 'center', position: 'relative' }}>
      <BookCover idx={4} x={6} y={20} rot={-9} w={92} h={130} />
      <BookCover idx={1} x={66} y={6} rot={3} w={92} h={140} />
      <BookCover idx={3} x={124} y={26} rot={11} w={92} h={130} />
      <Svg viewBox="0 0 220 170" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        {[0, 1, 2].map((i) => (
          <Circle key={i} cx={112} cy={80} r={50 + i * 14} fill="none" stroke={p.primary} strokeOpacity={0.18 - i * 0.05} strokeWidth={1} strokeDasharray="2 5" />
        ))}
      </Svg>
    </View>
  );
}
