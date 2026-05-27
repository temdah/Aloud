import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    container: {
      width: '100%',
      justifyContent: 'center',
    },
    trackBg: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 4,
      borderRadius: 2,
      backgroundColor: p.surfaceSunk,
    },
  });
