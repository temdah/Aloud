import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Library: undefined;
  Reader: { docId: string };
  Settings: undefined;
  Download: undefined;
  TextToSpeechDemo: undefined;
};

export type AppNavigation = NativeStackNavigationProp<RootStackParamList>;
export type ReaderRoute = RouteProp<RootStackParamList, 'Reader'>;
