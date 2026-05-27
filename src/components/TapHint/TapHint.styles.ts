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
      paddingLeft: 14,
      paddingRight: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    label: {
      flex: 1,
    },
    close: {
      padding: 2,
    },
  });
