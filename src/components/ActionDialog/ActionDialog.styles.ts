import { StyleSheet } from 'react-native';
import { RADIUS } from '../../theme';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      elevation: 1000,
    },
    center: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 28,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: p.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: p.border,
      padding: 20,
    },
    title: {
      marginBottom: 6,
    },
    message: {
      marginBottom: 18,
    },
    actions: {
      gap: 10,
    },
  });
