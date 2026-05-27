import { StyleSheet } from 'react-native';
import { RADIUS } from '../../theme';
import type { Palette } from '../../theme';

export const makeStyles = (p: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: RADIUS.lg,
      padding: 16,
      marginBottom: 14,
    },
    cardActive: {
      borderColor: p.primary,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    titleWrap: {
      flex: 1,
      paddingRight: 12,
    },
    tagline: {
      marginTop: 2,
    },
    inUseBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    overview: {
      marginTop: 10,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
    },
    footer: {
      marginTop: 14,
    },
    deleteWrap: {
      marginTop: 8,
    },
    progressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    errorText: {
      marginBottom: 10,
    },
  });
