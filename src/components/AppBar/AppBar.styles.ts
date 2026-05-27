import { Platform, StatusBar, StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

const STATUS_BAR_INSET = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;

export const makeStyles = (_p: Palette) =>
  StyleSheet.create({
    container: {
      paddingTop: STATUS_BAR_INSET,
      borderBottomWidth: 1,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 56,
      paddingHorizontal: 8,
    },
    titleWrap: {
      flex: 1,
      minWidth: 0,
    },
    subtitle: {
      marginTop: 1,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
  });
