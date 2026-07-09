package app.wifisoundthing.audio

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat

/**
 * Hardware/system AAC-LC encoder wrapped around [MediaCodec] in synchronous mode.
 * One instance per capture session; not thread-safe, drive it from a single thread.
 */
class AacEncoder(
    sampleRate: Int,
    channelCount: Int,
    bitrate: Int,
) {
    private val codec: MediaCodec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)

    init {
        val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, sampleRate, channelCount).apply {
            setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
            setInteger(MediaFormat.KEY_BIT_RATE, bitrate)
            setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 65536)
        }
        codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    }

    fun start() = codec.start()

    /**
     * Feeds [length] bytes of 16-bit PCM and invokes [onFrame] for every complete
     * encoded AAC frame that becomes available. Codec-config buffers are skipped
     * (the AudioSpecificConfig is derived analytically, see AacCsd).
     */
    fun encode(pcm: ByteArray, length: Int, ptsUs: Long, onFrame: (frame: ByteArray, ptsUs: Long) -> Unit) {
        var offset = 0
        var stalls = 0
        while (offset < length) {
            val inIndex = codec.dequeueInputBuffer(INPUT_TIMEOUT_US)
            if (inIndex < 0) {
                drain(onFrame)
                // Codec refuses input even with outputs drained: drop the rest of
                // this chunk rather than stalling the capture thread.
                if (++stalls > MAX_INPUT_STALLS) return
                continue
            }
            stalls = 0
            val inBuf = codec.getInputBuffer(inIndex) ?: continue
            inBuf.clear()
            val chunk = minOf(length - offset, inBuf.remaining())
            inBuf.put(pcm, offset, chunk)
            codec.queueInputBuffer(inIndex, 0, chunk, ptsUs, 0)
            offset += chunk
        }
        drain(onFrame)
    }

    private fun drain(onFrame: (ByteArray, Long) -> Unit) {
        val info = MediaCodec.BufferInfo()
        while (true) {
            val outIndex = codec.dequeueOutputBuffer(info, 0)
            when {
                outIndex >= 0 -> {
                    if (info.size > 0 && (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0) {
                        val outBuf = codec.getOutputBuffer(outIndex)!!
                        val frame = ByteArray(info.size)
                        outBuf.position(info.offset)
                        outBuf.get(frame)
                        onFrame(frame, info.presentationTimeUs)
                    }
                    codec.releaseOutputBuffer(outIndex, false)
                }
                outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> continue
                else -> return
            }
        }
    }

    fun release() {
        try {
            codec.stop()
        } catch (_: Exception) {
        }
        codec.release()
    }

    private companion object {
        const val INPUT_TIMEOUT_US = 10_000L
        const val MAX_INPUT_STALLS = 20
    }
}
