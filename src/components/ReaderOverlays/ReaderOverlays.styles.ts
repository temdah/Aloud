import { StyleSheet } from 'react-native';
import { SPACE } from '../../theme';

export const makeStyles = () =>
  StyleSheet.create({
    sheetBody: { paddingHorizontal: SPACE[5], paddingBottom: SPACE[5] },
    speedValue: { textAlign: 'center', marginVertical: SPACE[3] },
    sliderLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: SPACE[2],
    },
    presetRow: {
      flexDirection: 'row',
      gap: SPACE[2],
      marginTop: SPACE[6],
      flexWrap: 'wrap',
    },
  });
