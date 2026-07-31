import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: p.background,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    intro: {
      lineHeight: 22,
    },
    updated: {
      marginTop: 8,
      marginBottom: 4,
    },
    section: {
      marginTop: 20,
    },
    sectionTitle: {
      marginBottom: 6,
    },
    para: {
      lineHeight: 22,
      marginTop: 6,
    },
    bulletRow: {
      flexDirection: 'row',
      marginTop: 6,
      paddingLeft: 4,
    },
    bulletDot: {
      marginRight: 8,
    },
    bulletText: {
      flex: 1,
      lineHeight: 22,
    },
  });
