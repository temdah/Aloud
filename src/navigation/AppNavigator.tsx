import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import DownloadScreen from '../screens/DownloadScreen';
import LibraryScreen from '../screens/LibraryScreen';
import ReaderScreen from '../screens/ReaderScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TextToSpeechDemoScreen from '../screens/TextToSpeechDemoScreen';
import { useTheme } from '../theme';
import type { RootStackParamList } from './navigationTypes';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Screens with their own AppBar manage their own header/back; Download and the
// diagnostics screen rely on the native stack header instead.
export function AppNavigator() {
  const { palette: p, mode } = useTheme();

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
    <NavigationContainer theme={navTheme}>
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
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Download" component={DownloadScreen} options={{ headerShown: true, title: 'Voice model' }} />
        <Stack.Screen name="TextToSpeechDemo" component={TextToSpeechDemoScreen} options={{ headerShown: true, title: 'Voice engine' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
