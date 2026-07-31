import { StyleSheet } from 'react-native';
import { RADIUS } from '../../theme';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: p.background,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 24,
      paddingTop: 8,
    },
    speedCard: {
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 10,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    sliderWrap: {
      marginTop: 8,
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    spacer: {
      height: 12,
    },
    groupLabel: {
      marginBottom: 8,
      marginLeft: 4,
    },
    presetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomColor: p.border,
    },
    presetBody: {
      flex: 1,
    },
    advancedToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 6,
      paddingVertical: 12,
      marginTop: 4,
    },
    qualityCard: {
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: RADIUS.md,
      padding: 18,
    },
    qualityHint: {
      marginTop: 2,
    },
    qualitySliderWrap: {
      marginTop: 14,
    },
    storageCard: {
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: RADIUS.md,
      overflow: 'hidden',
    },
    leadingPrimary: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: p.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    leadingMuted: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: p.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
