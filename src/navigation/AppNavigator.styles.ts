import { StyleSheet } from 'react-native';
import type { Palette } from '../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    body: {
      flex: 1,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: p.surfaceSunk,
      borderTopWidth: 1,
      borderTopColor: p.border,
      paddingBottom: 6,
    },
    tab: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
    },
    tabLabel: {
      fontFamily: 'DMSans_600SemiBold',
      fontSize: 11,
    },
  });
