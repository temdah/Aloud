import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    hint: {
      position: 'absolute',
      left: 24,
      right: 24,
      bottom: 16,
      backgroundColor: p.text,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
  });
