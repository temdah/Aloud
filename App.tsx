import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { AppNavigator } from './src/navigation';
import { Spinner } from './src/components';
import { fontsToLoad, LIGHT, ThemeProvider } from './src/theme';

export default function App() {
  const [fontsLoaded] = useFonts(fontsToLoad);

  return (
    <ThemeProvider>
      {fontsLoaded ? (
        <AppNavigator />
      ) : (
        <View style={{ flex: 1, backgroundColor: LIGHT.background, alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size={28} color={LIGHT.primary} />
        </View>
      )}
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
