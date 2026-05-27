import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { AppShell } from './AppShell';
import { Spinner } from '../components';
import { fontsToLoad, LIGHT, ThemeProvider } from '../theme';

export default function App() {
  const [fontsLoaded] = useFonts(fontsToLoad);

  return (
    <ThemeProvider>
      {fontsLoaded ? (
        <AppShell />
      ) : (
        <View style={{ flex: 1, backgroundColor: LIGHT.background, alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size={28} color={LIGHT.primary} />
        </View>
      )}
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
