import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (_p: Palette) =>
  StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 18,
    },
    leading: {
      flexShrink: 0,
    },
    body: {
      flex: 1,
      minWidth: 0,
    },
    subtitle: {
      marginTop: 2,
    },
    trailing: {
      flexShrink: 0,
    },
  });
