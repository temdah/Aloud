import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    track: {
      position: 'absolute',
      right: 2,
      top: 10,
      bottom: 10,
      width: 36,
    },
    rail: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: '50%',
      marginLeft: -1.5,
      width: 3,
      borderRadius: 2,
      backgroundColor: p.border,
    },
    thumb: {
      position: 'absolute',
      top: 0,
      left: '50%',
      borderRadius: 6,
      backgroundColor: p.primary,
      borderWidth: 2,
      borderColor: p.background,
    },
    ghost: {
      position: 'absolute',
      top: 0,
      left: '50%',
      borderRadius: 9,
      backgroundColor: p.primary,
      opacity: 0.4,
    },
    // A wide, non-interactive layer so the bubble sizes to its content (the
    // narrow track would otherwise squeeze the label to "…").
    bubbleLayer: {
      position: 'absolute',
      top: 10,
      bottom: 10,
      right: 44,
      width: 240,
    },
    bubble: {
      position: 'absolute',
      right: 0,
      maxWidth: 240,
      backgroundColor: p.primary,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 12,
    },
  });
