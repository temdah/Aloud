import { StyleSheet } from 'react-native';
import { RADIUS } from '../../theme';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: p.background,
    },
    content: {
      padding: 20,
      paddingBottom: 48,
    },
    notReady: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 40,
    },
    notReadyText: {
      textAlign: 'center',
    },
    intro: {
      marginBottom: 22,
    },
    sectionLabel: {
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    card: {
      backgroundColor: p.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: p.border,
      overflow: 'hidden',
      marginBottom: 22,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomColor: p.border,
    },
    rowDivider: {
      borderBottomWidth: 1,
    },
    optionBody: {
      flex: 1,
      gap: 3,
    },
    rowValue: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    speedRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 22,
    },
    estimate: {
      borderWidth: 1,
      borderRadius: RADIUS.md,
      padding: 14,
      gap: 4,
      marginBottom: 18,
    },
    estimateNote: {
      lineHeight: 16,
    },
    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderRadius: RADIUS.md,
      padding: 14,
      marginBottom: 18,
    },
    noticeText: {
      flex: 1,
    },
    footer: {
      gap: 12,
    },
    progressText: {
      textAlign: 'center',
    },
    langRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 4,
    },
  });
