import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: p.background,
    },
    hero: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: {
      paddingHorizontal: 28,
      alignItems: 'center',
    },
    lead: {
      marginTop: 12,
      textAlign: 'center',
      lineHeight: 24,
    },
    content: {
      padding: 20,
      paddingBottom: 12,
    },
    stepTitle: {
      marginBottom: 6,
    },
    stepIntro: {
      marginBottom: 18,
      lineHeight: 22,
    },
    presetCard: {
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: 14,
      overflow: 'hidden',
    },
    presetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    presetBody: {
      flex: 1,
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      gap: 10,
    },
    hint: {
      textAlign: 'center',
    },
    consent: {
      textAlign: 'center',
      lineHeight: 18,
      marginTop: 2,
    },
    readyBadge: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.surfaceAlt,
    },
  });
