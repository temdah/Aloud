import { useMemo } from 'react';
import { Pressable, Text } from 'react-native';
import { elevation, ty, TYPE, useTheme } from '../../theme';
import type { IconName } from '../../types';
import { Icon } from '../Icon';
import { makeStyles } from './FAB.styles';

export type FABProps = {
  icon: IconName;
  label: string;
  onPress?: () => void;
  raised?: boolean; // lift above the now-playing pill so they don't overlap
};

// Floating action button (import PDF). Sits flush near the bottom by default and
// lifts above the now-playing pill when one is present.
export function FAB({ icon, label, onPress, raised = false }: FABProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.fab, raised && styles.fabRaised, elevation(3)]}
    >
      <Icon name={icon} size={20} color={p.onPrimary} />
      <Text style={ty(TYPE.label, p.onPrimary)}>{label}</Text>
    </Pressable>
  );
}
