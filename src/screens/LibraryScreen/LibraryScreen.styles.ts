import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: p.background,
    },
    swatchRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      paddingHorizontal: 20,
      paddingTop: 8,
      justifyContent: 'center',
    },
    swatch: {
      width: 48,
      height: 48,
      borderRadius: 24,
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
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 16,
      marginTop: 8,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: p.surfaceAlt,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 6,
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
    noMatch: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 80,
    },
  });
