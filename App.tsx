import { StatusBar } from 'expo-status-bar';
import TextToSpeechDemoScreen from './src/screens/TextToSpeechDemoScreen';

export default function App() {
  return (
    <>
      <TextToSpeechDemoScreen />
      <StatusBar style="auto" />
    </>
  );
}
