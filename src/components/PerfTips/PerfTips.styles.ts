import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingLeft: 14,
      paddingRight: 6,
      marginHorizontal: 12,
      marginBottom: 8,
      borderRadius: 14,
      backgroundColor: p.surfaceAlt,
      borderWidth: 1,
      borderColor: p.border,
    },
    bannerBody: {
      flex: 1,
    },
    tips: {
      gap: 14,
    },
    tip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    tipBody: {
      flex: 1,
    },
    note: {
      paddingVertical: 4,
    },
  });
