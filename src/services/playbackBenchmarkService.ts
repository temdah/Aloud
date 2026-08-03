import { getDevicePerformanceSnapshot } from '../../modules/device-performance';
import {
  classifyDevicePressure,
  clearPlaybackDiagnostics,
  getPlaybackDiagnostics,
  prefetchDepth,
} from '../playback';
import {
  clearNarrationPerfCounters,
  getNarrationPerfCounters,
  getSynthRtf,
} from '../supertonic';
import {
  benchmarkRow,
  formatBytes,
  maximum,
  milliseconds,
  minimum,
  optionalMilliseconds,
  optionalNumber,
  percentile,
  summarizeDurations,
  thermalStatusLabel,
} from './benchmarkFormatting';

export function resetPlaybackBenchmark(): void {
  clearPlaybackDiagnostics();
  clearNarrationPerfCounters();
}

export function reportPlaybackBenchmark(modelId: string | null): string[] {
  const diagnostics = getPlaybackDiagnostics();
  const counters = getNarrationPerfCounters();
  const device = getDevicePerformanceSnapshot();
  const completed = diagnostics.traces.filter((trace) => trace.outcome === 'playing');
  const tapTimes = completed.flatMap((trace) => trace.playerPlayingMs == null ? [] : [trace.playerPlayingMs]);
  const queueTimes = completed.flatMap((trace) => trace.queueWaitMs == null ? [] : [trace.queueWaitMs]);
  const decisions: Record<string, number> = {};
  for (const trace of diagnostics.traces) {
    const key = trace.cacheDecision ?? 'no-decision';
    decisions[key] = (decisions[key] ?? 0) + 1;
  }
  const fastLeadChars = diagnostics.traces.flatMap((trace) => trace.fastLeadChars == null ? [] : [trace.fastLeadChars]);
  const gapTimes = diagnostics.boundaryGaps.map((gap) => gap.durationMs);
  const cachedGapTimes = diagnostics.boundaryGaps.filter((gap) => gap.nextWasCached).map((gap) => gap.durationMs);
  const missedGapTimes = diagnostics.boundaryGaps.filter((gap) => !gap.nextWasCached).map((gap) => gap.durationMs);
  const depths = diagnostics.prefetch.map((sample) => sample.depth);
  const throughputs = diagnostics.prefetch.flatMap((sample) => sample.synthThroughput == null ? [] : [sample.synthThroughput]);
  const lines = [
    '\n── Production reader playback ──',
    benchmarkRow('requests', `${diagnostics.traces.length} · playing ${completed.length} · cancelled ${diagnostics.traces.filter((trace) => trace.outcome === 'cancelled').length} · errors ${diagnostics.traces.filter((trace) => trace.outcome === 'error').length}`),
    benchmarkRow('cache decisions', Object.entries(decisions).map(([key, count]) => `${key}:${count}`).join('  ') || '(none)'),
    benchmarkRow('tap → playing p50/p95', tapTimes.length ? `${milliseconds(percentile(tapTimes, 0.5))} / ${milliseconds(percentile(tapTimes, 0.95))}` : '(no completed requests)'),
    benchmarkRow('queue wait p50/p95', queueTimes.length ? `${milliseconds(percentile(queueTimes, 0.5))} / ${milliseconds(percentile(queueTimes, 0.95))}` : '(no synthesis requests)'),
    benchmarkRow('fast-lead chars', fastLeadChars.length ? `median ${Math.round(percentile(fastLeadChars, 0.5))} · min ${minimum(fastLeadChars)} · max ${maximum(fastLeadChars)}` : '(none)'),
    benchmarkRow('boundary gap p50/p95', gapTimes.length ? `${milliseconds(percentile(gapTimes, 0.5))} / ${milliseconds(percentile(gapTimes, 0.95))} · max ${milliseconds(maximum(gapTimes))}` : '(none crossed)'),
    benchmarkRow('cached boundary gaps', summarizeDurations(cachedGapTimes)),
    benchmarkRow('uncached boundary gaps', summarizeDurations(missedGapTimes)),
    benchmarkRow('prefetch depth', depths.length ? `median ${percentile(depths, 0.5)} · min ${minimum(depths)} · max ${maximum(depths)}` : '(none)'),
    benchmarkRow('synth throughput', throughputs.length ? `median ${percentile(throughputs, 0.5).toFixed(2)}× realtime` : '(not available)'),
    benchmarkRow('actual syntheses', String(counters.synthesesStarted)),
    benchmarkRow('deduplicated waits', String(counters.deduplicatedWaiters)),
    '  ── latest request waterfalls ──',
  ];

  diagnostics.traces.slice(-10).forEach((trace) => {
    lines.push(`  #${trace.id} ${trace.kind} · ${trace.chars}c · ${trace.cacheDecision ?? 'no decision'} · ${trace.outcome}`);
    lines.push(`    cache ${optionalMilliseconds(trace.cacheDecisionMs)} · queue ${optionalMilliseconds(trace.queueWaitMs)} · ready ${optionalMilliseconds(trace.prepareMs)} · loaded ${optionalMilliseconds(trace.playerLoadedMs)} · playing ${optionalMilliseconds(trace.playerPlayingMs)}`);
    if (trace.synthesis) {
      lines.push(`    synth ${milliseconds(trace.synthesis.synthMs)} · PCM ${milliseconds(trace.synthesis.pcmMs)} · AAC ${milliseconds(trace.synthesis.aacMs)} · production total ${milliseconds(trace.synthesis.totalMs)}`);
    }
  });

  lines.push('  ── device state ──');
  if (!device) {
    lines.push('  Native device diagnostics unavailable in this build. Rebuild the APK to enable them.');
  } else {
    lines.push(benchmarkRow('thermal status', thermalStatusLabel(device.thermalStatus)));
    lines.push(benchmarkRow('battery', `${optionalNumber(device.batteryPercent, '%')} · ${optionalNumber(device.batteryTemperatureC, ' °C')} · saver ${device.powerSaveMode ? 'on' : 'off'}`));
    lines.push(benchmarkRow('memory available', `${formatBytes(device.availableMemoryBytes)} / ${formatBytes(device.totalMemoryBytes)} · low ${device.lowMemory ? 'yes' : 'no'}`));
    lines.push(benchmarkRow('memory threshold', formatBytes(device.memoryThresholdBytes)));
    lines.push(benchmarkRow('app memory class', `${device.appMemoryClassMb} MB · large ${device.largeAppMemoryClassMb} MB`));
    lines.push(benchmarkRow('CPU cores', String(device.cpuCores)));
    const pressure = classifyDevicePressure(device);
    lines.push(benchmarkRow('playback pressure', pressure));
    lines.push(benchmarkRow('recommended prefetch', `${prefetchDepth(getSynthRtf(modelId), pressure)} clips`));
  }
  return lines;
}
