import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (_p: Palette) =>
  StyleSheet.create({
    body: {
      flex: 1,
      paddingHorizontal: 24,
      justifyContent: 'center',
    },
    titleWrap: {
      marginTop: 32,
      alignSelf: 'center',
    },
    subtitle: {
      marginTop: 10,
      marginBottom: 32,
      textAlign: 'center',
    },
  });
