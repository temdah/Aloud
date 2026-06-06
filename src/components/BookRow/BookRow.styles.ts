import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 18,
      borderBottomColor: p.border,
    },
    body: {
      flex: 1,
      minWidth: 0,
    },
    author: {
      marginTop: 1,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
    },
    progressWrap: {
      flex: 1,
      maxWidth: 100,
    },
    trailing: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    playCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: p.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
