import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (_p: Palette) =>
  StyleSheet.create({
    container: {
      marginTop: 24,
      height: 140,
      alignItems: 'center',
      justifyContent: 'center',
    },
    svg: {
      transform: [{ rotate: '-90deg' }],
    },
    centerOverlay: {
      position: 'absolute',
      alignItems: 'center',
    },
    caption: {
      marginTop: 2,
    },
  });
