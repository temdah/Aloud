import { useMemo } from 'react';
import { Button, Text, View } from 'react-native';
import { ty, TYPE, useTheme } from '../../theme';
import { makeStyles } from './DeveloperAction.styles';

type DeveloperActionProps = {
  order: string;
  title: string;
  description: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'danger';
};

export function DeveloperAction({ order, title, description, onPress, disabled, tone = 'primary' }: DeveloperActionProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    <View style={styles.card}>
      <Text style={[ty(TYPE.overline, palette.primary), styles.order]}>{order}</Text>
      <Button title={title} color={tone === 'danger' ? palette.danger : palette.primary} onPress={onPress} disabled={disabled} />
      <Text style={[ty(TYPE.bodySmall, palette.textMuted), styles.description]}>{description}</Text>
    </View>
  );
}
