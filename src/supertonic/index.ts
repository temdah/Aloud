// Public API for the Supertonic on-device TTS module.

export { DEFAULT_VOICE, AVAILABLE_VOICES } from './models/modelCatalog';
export { ensureModelsDownloaded, areModelsDownloaded } from './models/modelDownloader';
export { loadTextToSpeech, loadVoiceStyle } from './textToSpeechLoader';
export { TextToSpeech } from './synthesis/textToSpeech';
export { VoiceStyle } from './synthesis/voiceStyle';
export { encodeWav } from './synthesis/wavEncoder';
export { AVAILABLE_LANGUAGES, isLanguageSupported } from './text/languages';
export { chunkText, buildChunks, ensureChunkAudio, isChunkCached, clearDocumentCache, loadChunks } from './narration';
export type { NarrationSettings } from './narration';
export type { ModelDownloadProgress } from './models/modelTypes';
export type { SupertonicConfig, SynthesisProgress, SynthesisResult } from './synthesis/synthesisTypes';
