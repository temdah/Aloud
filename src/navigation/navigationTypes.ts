import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Library: undefined;
  Reader: { docId: string };
  Prerender: { docId: string };
  Settings: undefined;
  VoiceModel: undefined;
  TextToSpeechDemo: undefined;
  Licenses: undefined;
};

export type AppNavigation = NativeStackNavigationProp<RootStackParamList>;
export type ReaderRoute = RouteProp<RootStackParamList, 'Reader'>;
export type PrerenderRoute = RouteProp<RootStackParamList, 'Prerender'>;
