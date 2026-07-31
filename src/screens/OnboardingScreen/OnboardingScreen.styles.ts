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
    consentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingHorizontal: 4,
      marginBottom: 4,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: p.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    checkboxOn: {
      backgroundColor: p.primary,
      borderColor: p.primary,
    },
    consentText: {
      flex: 1,
      lineHeight: 18,
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
