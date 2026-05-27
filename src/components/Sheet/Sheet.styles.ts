import { StyleSheet } from 'react-native';
import { RADIUS } from '../../theme';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#000',
    },
    backdropPress: {
      flex: 1,
    },
    sheet: {
      backgroundColor: p.surface,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
    },
    grabberWrap: {
      paddingTop: 12,
      paddingBottom: 4,
      alignItems: 'center',
    },
    grabber: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: p.borderStrong,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingLeft: 20,
      paddingRight: 8,
    },
    title: {
      flex: 1,
    },
    body: {
      flex: 1,
    },
  });
