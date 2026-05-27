import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

// IconButton size/background/foreground all depend on the size/variant/selected
// props, so styling stays inline in IconButton.tsx; no static StyleSheet styles.
export const makeStyles = (_p: Palette) => StyleSheet.create({});
