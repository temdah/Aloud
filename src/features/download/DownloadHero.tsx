import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ty, TYPE, useTheme } from '../../theme';

type DownloadHeroProps = { progress: number };

const R = 58;
const CIRC = 2 * Math.PI * R;

// Circular download progress ring with a centered percentage.
export function DownloadHero({ progress }: DownloadHeroProps) {
  const { palette: p } = useTheme();
  return (
    <View style={{ marginTop: 24, height: 140, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={140} height={140} viewBox="0 0 140 140" style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={70} cy={70} r={R} fill="none" stroke={p.surfaceSunk} strokeWidth={8} />
        <Circle
          cx={70}
          cy={70}
          r={R}
          fill="none"
          stroke={p.primary}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${CIRC * progress} ${CIRC}`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={ty(TYPE.display, p.text)}>{Math.round(progress * 100)}%</Text>
        <Text style={[ty(TYPE.caption, p.textMuted), { marginTop: 2 }]}>downloading…</Text>
      </View>
    </View>
  );
}
