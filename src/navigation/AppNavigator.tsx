import { createNavigationContainerRef, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { MiniPlayer } from '../components/MiniPlayer';
import LibraryScreen from '../screens/LibraryScreen';
import LicensesScreen from '../screens/LicensesScreen';
import PrerenderScreen from '../screens/PrerenderScreen';
import ReaderScreen from '../screens/ReaderScreen';
import SettingsScreen from '../screens/SettingsScreen';
import StorageScreen from '../screens/StorageScreen';
import TextToSpeechDemoScreen from '../screens/TextToSpeechDemoScreen';
import VoiceModelScreen from '../screens/VoiceModelScreen';
import { useTheme } from '../theme';
import type { RootStackParamList } from './navigationTypes';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Container ref so the global MiniPlayer (rendered outside the navigator) can
// navigate and read the active route.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function AppNavigator() {
  const { palette: p, mode } = useTheme();
  const [routeName, setRouteName] = useState<string | undefined>(undefined);
  const syncRoute = useCallback(() => setRouteName(navigationRef.getCurrentRoute()?.name), []);
  const openReader = useCallback((docId: string) => {
    if (navigationRef.isReady()) navigationRef.navigate('Reader', { docId });
  }, []);

  const navTheme = useMemo<Theme>(
    () => ({
      ...DefaultTheme,
      dark: mode === 'dark',
      colors: {
        ...DefaultTheme.colors,
        primary: p.primary,
        background: p.background,
        card: p.surface,
        text: p.text,
        border: p.border,
      },
    }),
    [mode, p],
  );

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} onReady={syncRoute} onStateChange={syncRoute}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: p.background },
          headerStyle: { backgroundColor: p.surface },
          headerTintColor: p.text,
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="Library" component={LibraryScreen} />
        <Stack.Screen name="Reader" component={ReaderScreen} />
        <Stack.Screen name="Prerender" component={PrerenderScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Storage" component={StorageScreen} />
        <Stack.Screen name="Licenses" component={LicensesScreen} />
        <Stack.Screen name="VoiceModel" component={VoiceModelScreen} />
        <Stack.Screen name="TextToSpeechDemo" component={TextToSpeechDemoScreen} options={{ headerShown: true, title: 'Performance' }} />
      </Stack.Navigator>
      {/* Reader has its own transport bar → hide the mini player there. */}
      <MiniPlayer hidden={routeName === 'Reader'} onOpen={openReader} />
    </NavigationContainer>
  );
}
