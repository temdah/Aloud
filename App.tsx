import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation';
import { Spinner } from './src/components';
import { fontsToLoad, LIGHT, ThemeProvider } from './src/theme';

export default function App() {
  const [fontsLoaded] = useFonts(fontsToLoad);

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        {fontsLoaded ? (
          <AppNavigator />
        ) : (
          <View style={{ flex: 1, backgroundColor: LIGHT.background, alignItems: 'center', justifyContent: 'center' }}>
            <Spinner size={28} color={LIGHT.primary} />
          </View>
        )}
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
