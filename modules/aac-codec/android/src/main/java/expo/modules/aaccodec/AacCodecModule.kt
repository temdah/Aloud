package expo.modules.aaccodec

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AacEncodeException(code: Int) :
  CodedException("AAC encode failed (native code $code)")

class AacCodecModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AacCodec")

    // Encode WAV(s) -> one AAC .m4a. Runs off the JS thread (AsyncFunction).
    AsyncFunction("encodeWavsToM4a") { srcWavPaths: List<String>, dstPath: String, bitrate: Int ->
      val rc = AacEncoder.encode(srcWavPaths, dstPath, bitrate)
      if (rc != 0) throw AacEncodeException(rc)
      dstPath
    }

    // Encode raw 16-bit PCM bytes straight to one AAC .m4a (no temp WAV round-trip).
    AsyncFunction("encodePcmToM4a") { pcm16: ByteArray, sampleRate: Int, channels: Int, dstPath: String, bitrate: Int ->
      val rc = AacEncoder.encodePcm(pcm16, sampleRate, channels, dstPath, bitrate)
      if (rc != 0) throw AacEncodeException(rc)
      dstPath
    }

    // Losslessly stitch AAC .m4a files into one continuous .m4a (no re-encode).
    // Resolves each source clip's start offset (ms) in the stitched file.
    AsyncFunction("concatM4a") { srcM4aPaths: List<String>, dstPath: String ->
      val res = AacEncoder.concat(srcM4aPaths, dstPath)
      if (res.rc != 0) throw AacEncodeException(res.rc)
      res.startsMs
    }
  }
}
