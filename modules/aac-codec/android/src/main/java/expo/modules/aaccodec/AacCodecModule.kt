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
  }
}
