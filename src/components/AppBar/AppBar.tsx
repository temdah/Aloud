import { useMemo } from 'react';
import { Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { ty, TYPE, useTheme } from '../../theme';
import { IconButton } from '../IconButton';
import { makeStyles } from './AppBar.styles';

export type AppBarProps = {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ReactNode;
  transparent?: boolean;
};

export function AppBar({ title, subtitle, onBack, actions, transparent = false }: AppBarProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: transparent ? 'transparent' : p.background,
          borderBottomColor: transparent ? 'transparent' : p.border,
        },
      ]}
    >
      <View style={styles.row}>
        {onBack ? <IconButton icon="back" onPress={onBack} accessibilityLabel="Back" /> : null}
        <View style={[styles.titleWrap, { paddingLeft: onBack ? 0 : 8 }]}>
          {title ? <Text numberOfLines={1} style={ty(TYPE.title, p.text)}>{title}</Text> : null}
          {subtitle ? <Text numberOfLines={1} style={[ty(TYPE.caption, p.textMuted), styles.subtitle]}>{subtitle}</Text> : null}
        </View>
        <View style={styles.actions}>{actions}</View>
      </View>
    </View>
  );
}
