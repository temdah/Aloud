import type { TextToSpeech } from './synthesis/textToSpeech';
import type { VoiceStyle } from './synthesis/voiceStyle';

export type Engine = {
  modelId: string;
  tts: TextToSpeech;
  voices: Map<string, VoiceStyle>;
};
