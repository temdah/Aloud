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
      paddingHorizontal: 22,
      paddingTop: 18,
      paddingBottom: 24,
      paddingRight: 46,
    },
    pageSection: {
      marginBottom: 18,
    },
    pageHeader: {
      borderBottomWidth: 1,
      borderBottomColor: p.border,
      paddingBottom: 6,
      marginBottom: 12,
      opacity: 0.6,
    },
    pageNav: {
      flexDirection: 'row',
    },
    pageDivider: {
      textAlign: 'center',
      marginBottom: 8,
    },
    placeholderCard: {
      opacity: 0.5,
      minHeight: 440,
      justifyContent: 'flex-start',
    },
    skelLine: {
      height: 12,
      borderRadius: 6,
      backgroundColor: p.border,
      marginBottom: 12,
    },
    emptyPage: {
      minHeight: 64,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pageBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 18,
      paddingVertical: 4,
      borderTopWidth: 1,
      borderTopColor: p.border,
      backgroundColor: p.background,
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
    tocRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: 10,
    },
    tocTitle: {
      flexShrink: 1,
    },
    tocLeader: {
      flex: 1,
      minWidth: 24,
      marginHorizontal: 6,
      fontSize: 12,
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
