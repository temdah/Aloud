import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    fab: {
      position: 'absolute',
      right: 16,
      // Flush near the bottom when the mini-player isn't showing.
      bottom: 24,
      height: 56,
      paddingHorizontal: 22,
      backgroundColor: p.primary,
      borderRadius: 28,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    // Lifted clear of the now-playing pill (pill bottom 24 + ~66 tall + gap).
    fabRaised: {
      bottom: 104,
    },
  });
