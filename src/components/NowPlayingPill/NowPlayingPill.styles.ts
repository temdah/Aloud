import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    pill: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 24,
      backgroundColor: p.surface,
      borderRadius: 16,
      padding: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: p.border,
    },
    tapZone: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    body: {
      flex: 1,
      minWidth: 0,
    },
    stopButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toggle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: p.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
