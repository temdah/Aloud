import { useFonts } from 'expo-font';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation';
import { Spinner } from './src/components';
import { PlaybackProvider } from './src/playback';
import { PrerenderProvider } from './src/prerender';
import { fontsToLoad, LIGHT, ThemeProvider, useTheme } from './src/theme';

function AppStatusBar() {
  const { mode, palette } = useTheme();
  return <StatusBar barStyle={mode === 'light' ? 'dark-content' : 'light-content'} backgroundColor={palette.background} translucent={false} />;
}

export default function App() {
  const [fontsLoaded] = useFonts(fontsToLoad);

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        {fontsLoaded ? (
          <PlaybackProvider>
            <PrerenderProvider>
              <AppNavigator />
            </PrerenderProvider>
          </PlaybackProvider>
        ) : (
          <View style={{ flex: 1, backgroundColor: LIGHT.background, alignItems: 'center', justifyContent: 'center' }}>
            <Spinner size={28} color={LIGHT.primary} />
          </View>
        )}
        <AppStatusBar />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
