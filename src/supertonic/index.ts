// Public API for the Supertonic on-device TTS module.

export { DEFAULT_VOICE, AVAILABLE_VOICES, MODELS, findModel, getModel } from './models/modelCatalog';
export type { ModelInfo } from './models/modelCatalog';
export { ensureModelsDownloaded, areModelsDownloaded } from './models/modelDownloader';
export { deleteModel } from './models/modelStorage';
export { loadTextToSpeech, loadVoiceStyle } from './textToSpeechLoader';
export { TextToSpeech } from './synthesis/textToSpeech';
export { VoiceStyle } from './synthesis/voiceStyle';
export { encodeWav } from './synthesis/wavEncoder';
export { AVAILABLE_LANGUAGES, isLanguageSupported, languageLabel, LANGUAGE_LABELS } from './text/languages';
export type { SupportedLanguage } from './text/languages';
export { chunkText, buildChunks, ensureChunkAudio, isChunkCached, chunkAudioUri, settingsHash, clearDocumentCache, documentCacheStats, listCachedProfiles, clearProfileCache, loadChunks, readManifest, prerenderDocument } from './narration';
export type { NarrationSettings, PrerenderProgress, PrerenderResult, CachedProfile, ProfileMeta } from './narration';
export type { ModelDownloadProgress } from './models/modelTypes';
export type { SupertonicConfig, SynthesisProgress, SynthesisResult } from './synthesis/synthesisTypes';
