import { StyleSheet } from 'react-native';
import type { Palette } from '../../theme';

// Diagnostics screen uses fixed colors (not theme tokens); styles are static.
export const makeStyles = (_p: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingTop: 56, paddingHorizontal: 16 },
    title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
    steps: { fontSize: 14 },
    logBox: { flex: 1, marginTop: 12, backgroundColor: '#f2f2f2', borderRadius: 8, padding: 12 },
    logText: { fontFamily: 'monospace', fontSize: 12 },
  });
