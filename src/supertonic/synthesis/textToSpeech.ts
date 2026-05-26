import { Tensor } from 'onnxruntime-react-native';
import { lengthsToMask, UnicodeTextProcessor } from '../text/unicodeTextProcessor';
import type { SupertonicConfig, SupertonicSessions, SynthesisProgress, SynthesisResult } from './synthesisTypes';
import type { VoiceStyle } from './voiceStyle';

// Orchestrates the Supertonic inference pipeline:
// tokenize -> predict duration -> encode text -> denoise latent (looped) -> vocode.
// Ported from web/helper.js (TextToSpeech), with the denoising latent kept flat.
export class TextToSpeech {
  readonly sampleRate: number;

  constructor(
    private readonly config: SupertonicConfig,
    private readonly textProcessor: UnicodeTextProcessor,
    private readonly sessions: SupertonicSessions,
  ) {
    this.sampleRate = config.ae.sample_rate;
  }

  async synthesize(
    text: string,
    lang: string,
    voice: VoiceStyle,
    totalSteps: number,
    speed = 1.05,
    onProgress?: SynthesisProgress,
  ): Promise<SynthesisResult> {
    const { textIds, textMask } = this.textProcessor.tokenize([text], [lang]);
    const batchSize = 1;

    const textIdsTensor = new Tensor(
      'int64',
      BigInt64Array.from(textIds.flat().map((x) => BigInt(x))),
      [batchSize, textIds[0].length],
    );
    const textMaskTensor = new Tensor(
      'float32',
      Float32Array.from(textMask.flat(2)),
      [batchSize, 1, textMask[0][0].length],
    );

    // 1. Predict duration (seconds), adjusted by the speed factor.
    const durationOut = await this.sessions.durationPredictor.run({
      text_ids: textIdsTensor,
      style_dp: voice.dp,
      text_mask: textMaskTensor,
    });
    const durationsSec = Array.from(durationOut.duration.data as Float32Array, Number).map((d) => d / speed);

    // 2. Encode text.
    const textEncOut = await this.sessions.textEncoder.run({
      text_ids: textIdsTensor,
      style_ttl: voice.ttl,
      text_mask: textMaskTensor,
    });
    const textEmb = textEncOut.text_emb;

    // 3. Initialize the noisy latent.
    const { latent, latentDim, latentLen, latentMask } = this.initLatent(durationsSec);
    const latentShape = [batchSize, latentDim, latentLen];
    const latentMaskTensor = new Tensor(
      'float32',
      Float32Array.from(latentMask.flat(2)),
      [batchSize, 1, latentMask[0][0].length],
    );
    const totalStepTensor = new Tensor('float32', new Float32Array(batchSize).fill(totalSteps), [batchSize]);

    // 4. Denoising loop — feed each step's output straight back as the next input.
    let current = latent;
    for (let step = 0; step < totalSteps; step++) {
      onProgress?.(step + 1, totalSteps);
      const stepTensor = new Tensor('float32', new Float32Array(batchSize).fill(step), [batchSize]);
      const out = await this.sessions.vectorEstimator.run({
        noisy_latent: new Tensor('float32', current, latentShape),
        text_emb: textEmb,
        style_ttl: voice.ttl,
        latent_mask: latentMaskTensor,
        text_mask: textMaskTensor,
        current_step: stepTensor,
        total_step: totalStepTensor,
      });
      current = out.denoised_latent.data as unknown as Float32Array<ArrayBuffer>;
    }

    // 5. Vocode the final latent into a waveform.
    const vocoderOut = await this.sessions.vocoder.run({
      latent: new Tensor('float32', current, latentShape),
    });

    return { waveform: vocoderOut.wav_tts.data as Float32Array, durationsSec };
  }

  private initLatent(durationsSec: number[]) {
    const { base_chunk_size: baseChunkSize } = this.config.ae;
    const { latent_dim: latentDimBase, chunk_compress_factor: compress } = this.config.ttl;

    const batchSize = durationsSec.length;
    const maxDurationSec = Math.max(...durationsSec);
    const chunkSize = baseChunkSize * compress;
    const latentLen = Math.floor((Math.floor(maxDurationSec * this.sampleRate) + chunkSize - 1) / chunkSize);
    const latentDim = latentDimBase * compress;

    const latentLengths = durationsSec.map((d) =>
      Math.floor((Math.floor(d * this.sampleRate) + chunkSize - 1) / chunkSize),
    );
    const latentMask = lengthsToMask(latentLengths, latentLen);

    const latent = new Float32Array(batchSize * latentDim * latentLen);
    let idx = 0;
    for (let b = 0; b < batchSize; b++) {
      for (let d = 0; d < latentDim; d++) {
        for (let t = 0; t < latentLen; t++) {
          // Box-Muller Gaussian noise, masked to the valid latent length.
          const u1 = Math.max(0.0001, Math.random());
          const u2 = Math.random();
          const gaussian = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
          latent[idx++] = gaussian * latentMask[b][0][t];
        }
      }
    }

    return { latent, latentDim, latentLen, latentMask };
  }
}
