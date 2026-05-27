import { View } from 'react-native';
import { elevation, RADIUS, useTheme } from '../theme';
import type { CardProps } from './componentTypes';

export function Card({ children, padding = 16, elevation: level = 1, style }: CardProps) {
  const { palette: p } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: p.surface,
          borderRadius: RADIUS.lg,
          padding,
          borderWidth: level === 0 ? 1 : 0,
          borderColor: level === 0 ? p.border : undefined,
        },
        level === 0 ? null : elevation(level),
        style,
      ]}
    >
      {children}
    </View>
  );
}
