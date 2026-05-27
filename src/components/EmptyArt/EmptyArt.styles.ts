import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (_p: Palette) =>
  StyleSheet.create({
    container: {
      width: 220,
      height: 170,
      alignSelf: 'center',
      position: 'relative',
    },
    svg: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
  });
