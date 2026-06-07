import { StyleSheet } from 'react-native';
import { RADIUS } from '../../theme';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    scroll: {
      flex: 1,
    },
    card: {
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: RADIUS.md,
      overflow: 'hidden',
    },
    rowBase: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderBottomColor: p.border,
    },
    rowBody: {
      flex: 1,
      minWidth: 0,
    },
    footnote: {
      marginTop: 12,
      marginBottom: 12,
      textAlign: 'center',
    },
  });
