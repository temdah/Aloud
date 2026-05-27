import { Pressable, Text, View } from 'react-native';
import { ty, TYPE, useTheme } from '../theme';
import type { ListItemProps } from './componentTypes';

export function ListItem({ leading, title, subtitle, trailing, onPress, selected = false, divider = true }: ListItemProps) {
  const { palette: p } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      android_ripple={onPress ? { color: p.surfaceAlt } : undefined}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 18,
        backgroundColor: selected ? p.primarySoft : 'transparent',
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: p.border,
      }}
    >
      {leading ? <View style={{ flexShrink: 0 }}>{leading}</View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof title === 'string' ? <Text numberOfLines={1} style={ty(TYPE.bodyMedium, p.text)}>{title}</Text> : title}
        {typeof subtitle === 'string'
          ? <Text numberOfLines={1} style={[ty(TYPE.bodySmall, p.textMuted), { marginTop: 2 }]}>{subtitle}</Text>
          : subtitle}
      </View>
      {trailing ? <View style={{ flexShrink: 0 }}>{trailing}</View> : null}
    </Pressable>
  );
}
