package expo.modules.aaccodec

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.util.Log
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

private const val TAG = "aac-codec"
private const val MIME = MediaFormat.MIMETYPE_AUDIO_AAC
private const val TIMEOUT_US = 10_000L

// Error codes surfaced to JS (negative).
private const val ERR_NO_INPUT = -1
private const val ERR_BAD_WAV = -4
private const val ERR_ENCODE = -6

private data class WavInfo(val rate: Int, val channels: Int, val dataLen: Long)

// Result of a concat: an error code plus each source clip's start offset (ms) in
// the stitched file — the file's REAL clock, which drifts from predicted durations
// by AAC priming/padding + the inter-clip spacer.
private data class ConcatResult(val rc: Int, val startsMs: List<Double>)

// 16-bit PCM byte source for the shared encode loop (WAV files or an in-memory
// buffer). `read` returns bytes written to dst (up to max), or 0 when exhausted.
private interface PcmSource {
  fun read(dst: ByteArray, max: Int): Int
  fun close()
}

// Feeds raw headerless 16-bit PCM straight from memory (the narrator's samples).
private class ByteArrayPcmSource(private val data: ByteArray) : PcmSource {
  private var pos = 0
  override fun read(dst: ByteArray, max: Int): Int {
    if (pos >= data.size) return 0
    val n = minOf(max, data.size - pos)
    System.arraycopy(data, pos, dst, 0, n)
    pos += n
    return n
  }
  override fun close() {}
}

// Streams 16-bit PCM out of a sequence of canonical WAV files (as written by the
// JS wavEncoder). Reads them back-to-back so multiple chunks concatenate into one
// continuous AAC stream. Exposes the first file's rate/channels.
private class WavPcmSource(private val paths: List<String>) : PcmSource {
  var sampleRate = 0
    private set
  var channels = 0
    private set

  private var idx = 0
  private var stream: InputStream? = null
  private var remaining = 0L

  fun open(): Boolean = openNext()

  private fun openNext(): Boolean {
    closeStream()
    while (idx < paths.size) {
      val file = File(paths[idx]); idx++
      val s = BufferedInputStream(FileInputStream(file))
      val info = parseHeader(s)
      if (info == null) {
        try { s.close() } catch (_: Exception) {}
        continue
      }
      if (sampleRate == 0) {
        sampleRate = info.rate
        channels = info.channels
      }
      stream = s
      remaining = info.dataLen
      return true
    }
    return false
  }

  // Bytes read into dst (up to max), or 0 once all inputs are exhausted.
  override fun read(dst: ByteArray, max: Int): Int {
    while (true) {
      val s = stream ?: return 0
      if (remaining <= 0L) {
        if (!openNext()) return 0 else continue
      }
      val want = minOf(max.toLong(), remaining).toInt()
      val n = s.read(dst, 0, want)
      if (n <= 0) {
        remaining = 0L
        continue
      }
      remaining -= n.toLong()
      return n
    }
  }

  override fun close() = closeStream()

  private fun closeStream() {
    try { stream?.close() } catch (_: Exception) {}
    stream = null
  }

  // Parse a canonical 44-byte PCM WAV header (what wavEncoder writes), leaving the
  // stream positioned at the first PCM byte. null if it doesn't look like one.
  private fun parseHeader(s: InputStream): WavInfo? {
    val h = ByteArray(44)
    if (!readFully(s, h)) return null
    fun tag(off: Int) = String(h, off, 4, Charsets.US_ASCII)
    if (tag(0) != "RIFF" || tag(8) != "WAVE" || tag(36) != "data") return null
    val bb = ByteBuffer.wrap(h).order(ByteOrder.LITTLE_ENDIAN)
    val channels = bb.getShort(22).toInt()
    val rate = bb.getInt(24)
    val bits = bb.getShort(34).toInt()
    val dataLen = bb.getInt(40).toLong() and 0xFFFFFFFFL
    if (bits != 16 || channels < 1 || rate <= 0) return null
    return WavInfo(rate, channels, dataLen)
  }

  private fun readFully(s: InputStream, buf: ByteArray): Boolean {
    var off = 0
    while (off < buf.size) {
      val n = s.read(buf, off, buf.size - off)
      if (n < 0) return false
      off += n
    }
    return true
  }
}

internal object AacEncoder {
  // Encode WAV file(s) -> one .m4a. 0 on success, a negative ERR_ otherwise.
  // Heavy/synchronous — call from a background thread (AsyncFunction).
  fun encode(srcPaths: List<String>, dstPath: String, bitrate: Int): Int {
    if (srcPaths.isEmpty()) return ERR_NO_INPUT
    val source = WavPcmSource(srcPaths)
    if (!source.open()) return ERR_BAD_WAV
    return encodeFromSource(source, source.sampleRate, source.channels, dstPath, bitrate)
  }

  // Encode raw 16-bit mono/interleaved PCM bytes -> one .m4a, no temp WAV.
  fun encodePcm(pcm16: ByteArray, sampleRate: Int, channels: Int, dstPath: String, bitrate: Int): Int {
    if (pcm16.isEmpty()) return ERR_NO_INPUT
    return encodeFromSource(ByteArrayPcmSource(pcm16), sampleRate, channels, dstPath, bitrate)
  }

  // Shared MediaCodec + MediaMuxer encode loop, fed by any PcmSource. Deletes a
  // partial file on failure.
  private fun encodeFromSource(source: PcmSource, sampleRate: Int, channels: Int, dstPath: String, bitrate: Int): Int {
    val bytesPerFrame = 2 * channels

    val format = MediaFormat.createAudioFormat(MIME, sampleRate, channels).apply {
      setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
      setInteger(MediaFormat.KEY_BIT_RATE, bitrate)
      setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 64 * 1024)
    }

    var codec: MediaCodec? = null
    var muxer: MediaMuxer? = null
    var result = ERR_ENCODE
    try {
      codec = MediaCodec.createEncoderByType(MIME)
      codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
      codec.start()
      muxer = MediaMuxer(dstPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)

      val info = MediaCodec.BufferInfo()
      var trackIndex = -1
      var muxerStarted = false
      var inputDone = false
      var framesFed = 0L
      val pcm = ByteArray(8192)

      while (true) {
        if (!inputDone) {
          val inIndex = codec.dequeueInputBuffer(TIMEOUT_US)
          if (inIndex >= 0) {
            val inBuf = codec.getInputBuffer(inIndex)!!
            inBuf.clear()
            val cap = minOf(pcm.size, inBuf.remaining())
            val n = source.read(pcm, cap)
            if (n <= 0) {
              codec.queueInputBuffer(inIndex, 0, 0, ptsUs(framesFed, sampleRate), MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              inputDone = true
            } else {
              inBuf.put(pcm, 0, n)
              codec.queueInputBuffer(inIndex, 0, n, ptsUs(framesFed, sampleRate), 0)
              framesFed += (n / bytesPerFrame).toLong()
            }
          }
        }

        val outIndex = codec.dequeueOutputBuffer(info, TIMEOUT_US)
        when {
          outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
            if (muxerStarted) throw IllegalStateException("output format changed twice")
            trackIndex = muxer.addTrack(codec.outputFormat)
            muxer.start()
            muxerStarted = true
          }
          outIndex >= 0 -> {
            val outBuf = codec.getOutputBuffer(outIndex)!!
            // Drop the codec-config buffer (MediaMuxer captures CSD from the format).
            if ((info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) info.size = 0
            if (info.size > 0 && muxerStarted) {
              outBuf.position(info.offset)
              outBuf.limit(info.offset + info.size)
              muxer.writeSampleData(trackIndex, outBuf, info)
            }
            codec.releaseOutputBuffer(outIndex, false)
            if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
              result = 0
              break
            }
          }
          // INFO_TRY_AGAIN_LATER: nothing ready yet — loop and keep feeding input.
        }
      }
    } catch (e: Exception) {
      Log.e(TAG, "AAC encode failed", e)
      result = ERR_ENCODE
    } finally {
      try { codec?.stop() } catch (_: Exception) {}
      try { codec?.release() } catch (_: Exception) {}
      try { muxer?.stop() } catch (_: Exception) {}
      try { muxer?.release() } catch (_: Exception) {}
      source.close()
      if (result != 0) try { File(dstPath).delete() } catch (_: Exception) {}
    }
    return result
  }

  private fun ptsUs(framesPerChannel: Long, sampleRate: Int): Long =
    framesPerChannel * 1_000_000L / sampleRate

  // Losslessly stitch several AAC .m4a files (the per-chunk cache) into one
  // continuous .m4a — no re-encode. Copies each file's compressed samples with
  // MediaExtractor and re-muxes them back to back, offsetting timestamps so the
  // result is one gapless track. Returns 0 on success, a negative ERR_ otherwise.
  fun concat(srcPaths: List<String>, dstPath: String): ConcatResult {
    if (srcPaths.isEmpty()) return ConcatResult(ERR_NO_INPUT, emptyList())

    var muxer: MediaMuxer? = null
    var trackIndex = -1
    var muxerStarted = false
    var result = ERR_ENCODE
    val startsMs = ArrayList<Double>(srcPaths.size)
    try {
      muxer = MediaMuxer(dstPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      val buffer = java.nio.ByteBuffer.allocate(256 * 1024)
      val info = MediaCodec.BufferInfo()
      var ptsOffsetUs = 0L

      for (path in srcPaths) {
        // Start of THIS clip in the output = current running offset.
        startsMs.add(ptsOffsetUs / 1000.0)
        val extractor = MediaExtractor()
        try {
          extractor.setDataSource(path)
          var track = -1
          for (i in 0 until extractor.trackCount) {
            val mime = extractor.getTrackFormat(i).getString(MediaFormat.KEY_MIME)
            if (mime?.startsWith("audio/") == true) { track = i; break }
          }
          if (track < 0) return ConcatResult(ERR_BAD_WAV, emptyList())
          extractor.selectTrack(track)
          val format = extractor.getTrackFormat(track)
          if (!muxerStarted) {
            trackIndex = muxer.addTrack(format)
            muxer.start()
            muxerStarted = true
          }
          val frameUs = frameDurationUs(format)
          var lastPtsUs = ptsOffsetUs
          while (true) {
            val size = extractor.readSampleData(buffer, 0)
            if (size < 0) break
            info.offset = 0
            info.size = size
            info.presentationTimeUs = ptsOffsetUs + extractor.sampleTime
            info.flags = if ((extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC) != 0) {
              MediaCodec.BUFFER_FLAG_KEY_FRAME
            } else 0
            muxer.writeSampleData(trackIndex, buffer, info)
            lastPtsUs = info.presentationTimeUs
            extractor.advance()
          }
          // Start the next file one frame after the last sample so they don't overlap.
          ptsOffsetUs = lastPtsUs + frameUs
        } finally {
          extractor.release()
        }
      }
      result = if (muxerStarted) 0 else ERR_NO_INPUT
    } catch (e: Exception) {
      Log.e(TAG, "AAC concat failed", e)
      result = ERR_ENCODE
    } finally {
      try { muxer?.stop() } catch (_: Exception) {}
      try { muxer?.release() } catch (_: Exception) {}
      if (result != 0) try { File(dstPath).delete() } catch (_: Exception) {}
    }
    return ConcatResult(result, if (result == 0) startsMs else emptyList())
  }

  // Duration of one AAC access unit (1024 samples) in microseconds.
  private fun frameDurationUs(format: MediaFormat): Long {
    val rate = if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) format.getInteger(MediaFormat.KEY_SAMPLE_RATE) else 44100
    return 1024L * 1_000_000L / rate
  }
}
