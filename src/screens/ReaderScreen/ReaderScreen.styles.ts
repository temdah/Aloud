import { StyleSheet } from 'react-native';
import { RADIUS } from '../../theme';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: p.background,
    },
    body: {
      flex: 1,
    },
    scrollContent: {
      padding: 22,
      paddingBottom: 16,
    },
    card: {
      backgroundColor: p.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: p.border,
      paddingHorizontal: 24,
      paddingTop: 32,
      paddingBottom: 40,
    },
    pageLabel: {
      marginBottom: 18,
    },
    heading: {
      fontSize: 19,
      marginBottom: 18,
    },
    paragraph: {
      marginBottom: 14,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 12,
    },
    emptyText: {
      textAlign: 'center',
    },
    sheetBody: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    speedValue: {
      textAlign: 'center',
      marginVertical: 12,
    },
    sliderLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    presetRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 22,
      flexWrap: 'wrap',
    },
  });
