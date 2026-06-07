import { StyleSheet } from 'react-native';
import { RADIUS } from '../../theme';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: p.background,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 24,
      paddingTop: 8,
    },
    card: {
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: RADIUS.md,
      overflow: 'hidden',
    },
    leadingMuted: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: p.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: {
      paddingTop: 80,
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 24,
    },
    emptyText: {
      textAlign: 'center',
    },
    total: {
      marginTop: 12,
      marginBottom: 4,
      paddingHorizontal: 4,
    },
  });
