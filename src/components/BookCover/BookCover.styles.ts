import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

// BookCover position, size, rotation and tint derive from props, so styling
// stays inline in BookCover.tsx; no static StyleSheet styles.
export const makeStyles = (_p: Palette) => StyleSheet.create({});
