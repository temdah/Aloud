import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ty, TYPE, useTheme } from '../../theme';
import { makeStyles } from './ListItem.styles';

export type ListItemProps = {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  selected?: boolean;
  divider?: boolean;
};

export function ListItem({ leading, title, subtitle, trailing, onPress, selected = false, divider = true }: ListItemProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      android_ripple={onPress ? { color: p.surfaceAlt } : undefined}
      style={[
        styles.base,
        {
          backgroundColor: selected ? p.primarySoft : 'transparent',
          borderBottomWidth: divider ? 1 : 0,
          borderBottomColor: p.border,
        },
      ]}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.body}>
        {typeof title === 'string' ? <Text numberOfLines={1} style={ty(TYPE.bodyMedium, p.text)}>{title}</Text> : title}
        {typeof subtitle === 'string'
          ? <Text numberOfLines={1} style={[ty(TYPE.bodySmall, p.textMuted), styles.subtitle]}>{subtitle}</Text>
          : subtitle}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </Pressable>
  );
}
