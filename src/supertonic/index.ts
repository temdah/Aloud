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
export { firstSentenceEnd, sentenceBoundaries, sentenceSpans } from './text/segmentation';
export { maxChunkLen } from './text/sentenceRules';
export { DEFAULT_QUALITY, MIN_SYNTHESIS_STEPS, normalizeSynthesisSteps, qualityProfile, QUALITY_LABELS } from './qualityProfile';
export type { Quality, QualityProfile } from './qualityProfile';
export { chunkText, buildChunks, createNarrationPlan, DEFAULT_NARRATION_TONE, EMPTY_NARRATION_PLAN, buildSentenceAnchors, MAX_SENTENCE_ANCHOR_CHARS, sentenceAnchorId, sentenceCacheBaseName, sentenceSettingsHash, findChunkIndexForOffset, ensureChunkAudio, ensureLeadAudio, ensureSentenceAudio, isAcademicDocument, isChunkCached, isLeadCached, isSentenceCached, leadAudioFile, chunkAudioUri, sentenceAudioUri, readSentenceTiming, writeSentenceTiming, deleteChunkCache, deleteSentenceCache, deleteLeadCache, deleteAudiobookCache, isAudiobookCached, audiobookAudioUri, readAudiobookIndex, settingsHash, NARRATION_TONE_LABELS, normalizeNarrationTone, planNarrationTone, recordSentenceCachedProfile, clearDocumentCache, clearFragmentedCache, documentCacheStats, listCachedProfiles, clearProfileCache, loadChunks, loadNarrationPlan, readManifest, prerenderDocument, planProsody, ensureDurationTable, buildTimeline, loadDurationTable, loadDurationTableFromCache, cumulativeOffsetsSec, totalDurationSec, locateTime, clearNarrationPerfCounters, getNarrationPerfCounters, getSynthRtf } from './narration';
export type { NarrationMetricsReporter, NarrationPlan, NarrationSettings, NarrationSynthesisMetrics, PrerenderProgress, PrerenderResult, ProsodyBoundary, ProsodyPlan, TonePlan, CachedProfile, ProfileMeta, DurationTable, TimeLocation } from './narration';
export type { ModelDownloadProgress } from './models/modelTypes';
export type { SupertonicConfig, SynthesisDiagnostics, SynthesisProgress, SynthesisResult, SynthesisStage, SynthesisStageReporter } from './synthesis/synthesisTypes';
export { InferenceQueue } from './inferenceQueue';
export { silenceSampleCount } from './narration/silenceSamples';
