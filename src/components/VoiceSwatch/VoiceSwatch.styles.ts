import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    base: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
  });
