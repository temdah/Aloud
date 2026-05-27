import { StyleSheet } from 'react-native';
import { RADIUS } from '../../theme';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 12,
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
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderBottomColor: p.border,
    },
    rowBody: {
      flex: 1,
      minWidth: 0,
    },
    previewBase: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footnote: {
      marginTop: 12,
      textAlign: 'center',
    },
  });
