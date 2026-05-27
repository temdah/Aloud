import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: p.background,
    },
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    intro: {
      marginBottom: 18,
    },
  });
