import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (_p: Palette) =>
  StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 32,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
    },
  });
