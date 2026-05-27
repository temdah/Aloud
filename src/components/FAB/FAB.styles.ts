import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 90,
      height: 56,
      paddingHorizontal: 22,
      backgroundColor: p.primary,
      borderRadius: 28,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
  });
