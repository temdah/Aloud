import { StyleSheet } from 'react-native';
import { RADIUS, SPACE } from '../../theme';
import type { Palette } from '../../theme';

export const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      marginBottom: SPACE[3],
      padding: SPACE[3],
    },
    order: {
      marginBottom: SPACE[2],
      textTransform: 'uppercase',
    },
    description: {
      marginTop: SPACE[2],
    },
  });
