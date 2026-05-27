import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

// CoverThumb dimensions and tints derive from the idx/width/height props, so
// styling stays inline in CoverThumb.tsx; no static StyleSheet styles.
export const makeStyles = (_p: Palette) => StyleSheet.create({});
