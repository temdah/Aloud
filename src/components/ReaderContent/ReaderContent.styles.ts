import { StyleSheet } from 'react-native';
import { RADIUS, SPACE } from '../../theme';
import type { Palette } from '../../theme';

export const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    body: { flex: 1 },
    scrollContent: {
      paddingHorizontal: SPACE[5],
      paddingTop: SPACE[5],
      paddingBottom: SPACE[6],
      paddingRight: SPACE[9],
    },
    pageSection: { marginBottom: SPACE[5] },
    pageHeader: {
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
      paddingBottom: SPACE[2],
      marginBottom: SPACE[3],
      opacity: 0.6,
    },
    pageNav: { flexDirection: 'row' },
    pageDivider: { textAlign: 'center', marginBottom: SPACE[2] },
    placeholderCard: {
      opacity: 0.5,
      minHeight: 440,
      justifyContent: 'flex-start',
    },
    skelLine: {
      height: SPACE[3],
      borderRadius: RADIUS.sm,
      backgroundColor: palette.border,
      marginBottom: SPACE[3],
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
      gap: SPACE[5],
      paddingVertical: SPACE[1],
      borderTopWidth: 1,
      borderTopColor: palette.border,
      backgroundColor: palette.background,
    },
    card: {
      backgroundColor: palette.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: palette.border,
      paddingHorizontal: SPACE[6],
      paddingTop: SPACE[7],
      paddingBottom: SPACE[8],
    },
    heading: { marginBottom: SPACE[5] },
    image: {
      width: '100%',
      borderRadius: RADIUS.sm,
      backgroundColor: palette.surfaceAlt,
      marginVertical: SPACE[4],
    },
    tocRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: SPACE[3],
    },
    tocTitle: { flexShrink: 1 },
    tocLeader: {
      flex: 1,
      minWidth: SPACE[6],
      marginHorizontal: SPACE[2],
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACE[7],
      gap: SPACE[3],
    },
    emptyText: { textAlign: 'center' },
  });
