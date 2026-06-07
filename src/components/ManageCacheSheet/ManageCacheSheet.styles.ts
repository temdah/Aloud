import { StyleSheet } from 'react-native';
import { RADIUS } from '../../theme';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
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
    row: {
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
    empty: {
      paddingVertical: 32,
      alignItems: 'center',
    },
    footer: {
      paddingVertical: 12,
      gap: 8,
    },
    note: {
      marginTop: 4,
      textAlign: 'center',
    },
  });
