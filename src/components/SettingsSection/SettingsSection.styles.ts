import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (_p: Palette) =>
  StyleSheet.create({
    container: {
      marginTop: 16,
    },
    title: {
      paddingHorizontal: 4,
      paddingBottom: 8,
    },
  });
