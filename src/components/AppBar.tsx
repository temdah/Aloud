import { Platform, StatusBar, Text, View } from 'react-native';
import { ty, TYPE, useTheme } from '../theme';
import type { AppBarProps } from './componentTypes';
import { IconButton } from './IconButton';

const STATUS_BAR_INSET = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;

export function AppBar({ title, subtitle, onBack, actions, transparent = false }: AppBarProps) {
  const { palette: p } = useTheme();
  return (
    <View
      style={{
        paddingTop: STATUS_BAR_INSET,
        backgroundColor: transparent ? 'transparent' : p.background,
        borderBottomWidth: 1,
        borderBottomColor: transparent ? 'transparent' : p.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 56, paddingHorizontal: 8 }}>
        {onBack ? <IconButton icon="back" onPress={onBack} accessibilityLabel="Back" /> : null}
        <View style={{ flex: 1, minWidth: 0, paddingLeft: onBack ? 0 : 8 }}>
          {title ? <Text numberOfLines={1} style={ty(TYPE.title, p.text)}>{title}</Text> : null}
          {subtitle ? <Text numberOfLines={1} style={[ty(TYPE.caption, p.textMuted), { marginTop: 1 }]}>{subtitle}</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>{actions}</View>
      </View>
    </View>
  );
}
