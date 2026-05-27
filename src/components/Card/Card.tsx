import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { elevation, useTheme } from '../../theme';
import type { ElevationLevel } from '../../theme';
import { makeStyles } from './Card.styles';

export type CardProps = {
  children: ReactNode;
  padding?: number;
  elevation?: ElevationLevel;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, padding = 16, elevation: level = 1, style }: CardProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  return (
    <View
      style={[
        styles.base,
        {
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
