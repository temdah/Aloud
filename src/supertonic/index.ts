// Public API for the Supertonic on-device TTS module.

export { DEFAULT_VOICE, AVAILABLE_VOICES, MODELS, findModel, getModel } from './models/modelCatalog';
export type { ModelInfo } from './models/modelCatalog';
export { ensureModelsDownloaded, areModelsDownloaded } from './models/modelDownloader';
export { deleteModel } from './models/modelStorage';
export { loadTextToSpeech, loadVoiceStyle, ModelLoadError } from './textToSpeechLoader';
export { getEngine, getVoice, withEngine, getInferenceQueueSnapshot, isEngineResident, releaseCurrentEngine } from './engineManager';
export type { InferencePriority, InferenceQueueSnapshot } from './inferenceQueue';
export { TextToSpeech } from './synthesis/textToSpeech';
export { VoiceStyle } from './synthesis/voiceStyle';
export { encodeWav } from './synthesis/wavEncoder';
export { AVAILABLE_LANGUAGES, isLanguageSupported, languageLabel, LANGUAGE_LABELS } from './text/languages';
export type { SupportedLanguage } from './text/languages';
export { DEFAULT_QUALITY, qualityProfile, QUALITY_LABELS } from './qualityProfile';
export type { Quality, QualityProfile } from './qualityProfile';
export { chunkText, buildChunks, createNarrationPlan, EMPTY_NARRATION_PLAN, buildSentenceAnchors, MAX_SENTENCE_ANCHOR_CHARS, sentenceAnchorId, sentenceCacheBaseName, sentenceSettingsHash, findChunkIndexForOffset, ensureChunkAudio, ensureLeadAudio, ensureSentenceAudio, isChunkCached, isLeadCached, isSentenceCached, leadAudioFile, chunkAudioUri, sentenceAudioUri, readSentenceTiming, writeSentenceTiming, deleteChunkCache, deleteSentenceCache, deleteLeadCache, deleteAudiobookCache, isAudiobookCached, audiobookAudioUri, readAudiobookIndex, settingsHash, recordSentenceCachedProfile, clearDocumentCache, clearFragmentedCache, documentCacheStats, listCachedProfiles, clearProfileCache, loadChunks, loadNarrationPlan, readManifest, prerenderDocument, ensureDurationTable, buildTimeline, loadDurationTable, loadDurationTableFromCache, cumulativeOffsetsSec, totalDurationSec, locateTime, clearNarrationPerfCounters, getNarrationPerfCounters, getSynthRtf } from './narration';
export type { NarrationMetricsReporter, NarrationPlan, NarrationSettings, NarrationSynthesisMetrics, PrerenderProgress, PrerenderResult, CachedProfile, ProfileMeta, DurationTable, TimeLocation } from './narration';
export type { ModelDownloadProgress } from './models/modelTypes';
export type { SupertonicConfig, SynthesisDiagnostics, SynthesisProgress, SynthesisResult, SynthesisStage, SynthesisStageReporter } from './synthesis/synthesisTypes';
