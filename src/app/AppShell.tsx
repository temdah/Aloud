import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import DownloadScreen from '../features/download/DownloadScreen';
import LibraryScreen from '../features/library/LibraryScreen';
import ReaderScreen from '../features/reader/ReaderScreen';
import SettingsScreen from '../features/settings/SettingsScreen';
import TextToSpeechDemoScreen from '../features/diagnostics/TextToSpeechDemoScreen';
import { useTheme } from '../theme';

type Route = 'library' | 'reader' | 'settings' | 'download' | 'tts';
const ROUTES: Route[] = ['library', 'reader', 'settings', 'download', 'tts'];

// Minimal route switcher. The bottom strip is TEMP dev scaffolding so every
// screen is reachable — replace with a navigation library (out of scope now).
export function AppShell() {
  const { palette: p } = useTheme();
  const [route, setRoute] = useState<Route>('library');

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {route === 'library' && (
          <LibraryScreen onOpenBook={() => setRoute('reader')} onOpenSettings={() => setRoute('settings')} onImport={() => setRoute('download')} />
        )}
        {route === 'reader' && <ReaderScreen onBack={() => setRoute('library')} />}
        {route === 'settings' && <SettingsScreen onBack={() => setRoute('library')} />}
        {route === 'download' && <DownloadScreen />}
        {route === 'tts' && <TextToSpeechDemoScreen />}
      </View>

      <View style={{ flexDirection: 'row', backgroundColor: p.surfaceSunk, borderTopWidth: 1, borderTopColor: p.border, paddingBottom: 6 }}>
        {ROUTES.map((r) => (
          <Pressable key={r} onPress={() => setRoute(r)} style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: route === r ? p.primarySoft : 'transparent' }}>
            <Text style={{ fontFamily: 'DMSans_600SemiBold', fontSize: 11, color: route === r ? p.primary : p.textMuted }}>{r}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
