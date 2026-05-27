import { StyleSheet } from 'react-native';
import { RADIUS } from '../../theme';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: RADIUS.md,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: p.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
      minWidth: 0,
    },
    subtitle: {
      marginTop: 1,
    },
  });
