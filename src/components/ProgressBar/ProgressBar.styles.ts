import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

// ProgressBar track and fill dimensions/colors derive from the height/value/color
// props, so styling stays inline in ProgressBar.tsx; no static StyleSheet styles.
export const makeStyles = (_p: Palette) => StyleSheet.create({});
