import { StyleSheet } from 'react-native';
import { RADIUS } from '../../theme';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    base: {
      backgroundColor: p.surface,
      borderRadius: RADIUS.lg,
    },
  });
