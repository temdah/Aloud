import { StyleSheet } from 'react-native';
import { RADIUS } from '../../theme';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: p.background,
      paddingHorizontal: 24,
      paddingTop: 40,
      paddingBottom: 24,
    },
    heading: {
      marginTop: 8,
    },
    intro: {
      marginTop: 6,
    },
    overallSection: {
      marginTop: 20,
      marginBottom: 16,
    },
    overallRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 8,
    },
    fileCard: {
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: RADIUS.md,
      paddingVertical: 4,
    },
    fileRowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    doneBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    spacer: {
      flex: 1,
    },
    footnote: {
      textAlign: 'center',
      marginTop: 16,
    },
  });
