import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    container: {
      backgroundColor: p.surface,
      borderTopWidth: 1,
      borderTopColor: p.border,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 14,
    },
    timeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 2,
      marginBottom: 6,
    },
    controlRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    voiceWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
    },
    playWrap: {
      width: 68,
      height: 68,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: p.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    speedButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
    },
  });
