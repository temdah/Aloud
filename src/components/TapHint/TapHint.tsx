import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { elevation, ty, TYPE, useTheme } from '../../theme';
import { Icon } from '../Icon';
import { makeStyles } from './TapHint.styles';

// Floating hint shown on an idle reader before first playback.
export function TapHint() {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  return (
    <View
      pointerEvents="none"
      style={[styles.hint, elevation(2)]}
    >
      <Icon name="highlight" size={16} color={p.background} />
      <Text style={ty(TYPE.bodySmall, p.background)}>Tap any sentence to start reading from there</Text>
    </View>
  );
}
