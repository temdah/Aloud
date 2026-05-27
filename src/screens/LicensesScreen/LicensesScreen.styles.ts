import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: p.background,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 32,
    },
    intro: {
      marginBottom: 8,
    },
    entry: {
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: p.border,
    },
    license: {
      marginTop: 2,
    },
    note: {
      marginTop: 3,
    },
  });
