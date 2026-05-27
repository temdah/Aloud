import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

// Button layout is fully driven by size/variant/pressed/disabled props, so all
// of its styling stays inline in Button.tsx; no static StyleSheet styles.
export const makeStyles = (_p: Palette) => StyleSheet.create({});
