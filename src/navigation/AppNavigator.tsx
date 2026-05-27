import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import DownloadScreen from '../screens/DownloadScreen';
import LibraryScreen from '../screens/LibraryScreen';
import ReaderScreen from '../screens/ReaderScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TextToSpeechDemoScreen from '../screens/TextToSpeechDemoScreen';
import { useTheme } from '../theme';
import { makeStyles } from './AppNavigator.styles';

type Route = 'library' | 'reader' | 'settings' | 'download' | 'tts';
const ROUTES: Route[] = ['library', 'reader', 'settings', 'download', 'tts'];

// Minimal route switcher. The bottom strip is TEMP dev scaffolding so every
// screen is reachable — replace with a navigation library (out of scope now).
export function AppNavigator() {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const [route, setRoute] = useState<Route>('library');

  return (
    <View style={styles.root}>
      <View style={styles.body}>
        {route === 'library' && (
          <LibraryScreen onOpenBook={() => setRoute('reader')} onOpenSettings={() => setRoute('settings')} onImport={() => setRoute('download')} />
        )}
        {route === 'reader' && <ReaderScreen onBack={() => setRoute('library')} />}
        {route === 'settings' && <SettingsScreen onBack={() => setRoute('library')} />}
        {route === 'download' && <DownloadScreen />}
        {route === 'tts' && <TextToSpeechDemoScreen />}
      </View>

      <View style={styles.tabBar}>
        {ROUTES.map((r) => (
          <Pressable key={r} onPress={() => setRoute(r)} style={[styles.tab, { backgroundColor: route === r ? p.primarySoft : 'transparent' }]}>
            <Text style={[styles.tabLabel, { color: route === r ? p.primary : p.textMuted }]}>{r}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
