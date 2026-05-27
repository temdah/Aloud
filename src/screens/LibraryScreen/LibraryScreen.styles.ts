import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: p.background,
    },
    emptyBody: {
      flex: 1,
      paddingHorizontal: 24,
      justifyContent: 'center',
    },
    emptyTitle: {
      marginTop: 32,
      textAlign: 'center',
    },
    emptyText: {
      marginTop: 10,
      marginBottom: 32,
      textAlign: 'center',
    },
    filterRow: {
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 6,
    },
    listContent: {
      paddingBottom: 120,
    },
  });
