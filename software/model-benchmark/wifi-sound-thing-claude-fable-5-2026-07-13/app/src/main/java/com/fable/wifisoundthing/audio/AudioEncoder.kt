package com.fable.wifisoundthing.audio

import android.media.MediaCodec
import android.media.MediaFormat
import android.util.Log
import com.fable.wifisoundthing.protocol.OpusCsd
import com.fable.wifisoundthing.protocol.PcmChunker
import com.fable.wifisoundthing.protocol.Wire

/**
 * Turns captured PCM blocks into wire payloads. Two implementations: [OpusEncoder]
 * (Android's MediaCodec Opus encoder, ~128 kbit/s) and [PcmEncoder] (uncompressed
 * fallback, ~1.5 Mbit/s). The host tries Opus first and falls back to PCM automatically,
 * because the platform Opus *encoder* is missing or broken on some devices.
 */
interface AudioEncoder {
    data class Frame(val payload: ByteArray, val ptsUs: Long)

    val codecId: Byte

    /** Opus identification header for the decoder side; null for PCM. */
    val opusHead: ByteArray?

    /** Feeds one PCM block (16-bit LE, interleaved); returns zero or more encoded frames. */
    fun encode(pcm: ByteArray, length: Int, ptsUs: Long): List<Frame>

    fun release()
}

class PcmEncoder : AudioEncoder {
    override val codecId: Byte = Wire.CODEC_PCM16
    override val opusHead: ByteArray? = null

    override fun encode(pcm: ByteArray, length: Int, ptsUs: Long): List<AudioEncoder.Frame> {
        val chunks = PcmChunker.chunk(pcm, length)
        val out = ArrayList<AudioEncoder.Frame>(chunks.size)
        var offsetUs = 0L
        for (chunk in chunks) {
            out.add(AudioEncoder.Frame(chunk, ptsUs + offsetUs))
            offsetUs += Wire.pcmBytesToUs(chunk.size)
        }
        return out
    }

    override fun release() = Unit
}

class OpusEncoder private constructor(
    private val codec: MediaCodec,
    override val opusHead: ByteArray,
) : AudioEncoder {
    override val codecId: Byte = Wire.CODEC_OPUS

    override fun encode(pcm: ByteArray, length: Int, ptsUs: Long): List<AudioEncoder.Frame> {
        val out = ArrayList<AudioEncoder.Frame>(2)
        try {
            val inIndex = codec.dequeueInputBuffer(10_000)
            if (inIndex >= 0) {
                val buf = codec.getInputBuffer(inIndex)!!
                buf.clear()
                val size = minOf(length, buf.capacity())
                buf.put(pcm, 0, size)
                codec.queueInputBuffer(inIndex, 0, size, ptsUs, 0)
            }
            drain(out)
        } catch (e: Exception) {
            Log.w(TAG, "opus encode failed", e)
        }
        return out
    }

    private fun drain(out: MutableList<AudioEncoder.Frame>) {
        val info = MediaCodec.BufferInfo()
        while (true) {
            val index = codec.dequeueOutputBuffer(info, 0)
            if (index < 0) return
            if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG == 0 && info.size > 0) {
                val buf = codec.getOutputBuffer(index)!!
                val payload = ByteArray(info.size)
                buf.position(info.offset)
                buf.get(payload)
                out.add(AudioEncoder.Frame(payload, info.presentationTimeUs))
            }
            codec.releaseOutputBuffer(index, false)
        }
    }

    override fun release() {
        try {
            codec.stop()
        } catch (_: Exception) {
        }
        try {
            codec.release()
        } catch (_: Exception) {
        }
    }

    companion object {
        private const val TAG = "OpusEncoder"

        /**
         * Creates and warms up the platform Opus encoder. Feeds silence until the codec
         * config (OpusHead) appears so the handshake can advertise it. Returns null on any
         * failure — the caller then falls back to [PcmEncoder].
         */
        fun create(
            sampleRate: Int = Wire.SAMPLE_RATE,
            channels: Int = Wire.CHANNELS,
            bitrate: Int = Wire.OPUS_BITRATE,
        ): OpusEncoder? {
            var codec: MediaCodec? = null
            try {
                codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_OPUS)
                val format = MediaFormat.createAudioFormat(
                    MediaFormat.MIMETYPE_AUDIO_OPUS, sampleRate, channels
                )
                format.setInteger(MediaFormat.KEY_BIT_RATE, bitrate)
                codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
                codec.start()

                val head = warmUp(codec, sampleRate, channels)
                    ?: OpusCsd.defaultOpusHead(channels, sampleRate)
                return OpusEncoder(codec, head)
            } catch (e: Exception) {
                Log.w(TAG, "platform Opus encoder unavailable, falling back to PCM", e)
                try {
                    codec?.release()
                } catch (_: Exception) {
                }
                return null
            }
        }

        /** Feeds silence until csd-0 shows up (max ~1 s); returns the extracted OpusHead. */
        private fun warmUp(codec: MediaCodec, sampleRate: Int, channels: Int): ByteArray? {
            val blockBytes = sampleRate / 50 * channels * 2 // 20 ms
            val silence = ByteArray(blockBytes)
            val info = MediaCodec.BufferInfo()
            var ptsUs = 0L
            val deadline = System.nanoTime() + 1_000_000_000L
            var head: ByteArray? = null
            while (System.nanoTime() < deadline && head == null) {
                val inIndex = codec.dequeueInputBuffer(20_000)
                if (inIndex >= 0) {
                    val buf = codec.getInputBuffer(inIndex)!!
                    buf.clear()
                    buf.put(silence, 0, minOf(blockBytes, buf.capacity()))
                    codec.queueInputBuffer(inIndex, 0, minOf(blockBytes, buf.capacity()), ptsUs, 0)
                    ptsUs += 20_000
                }
                val outIndex = codec.dequeueOutputBuffer(info, 20_000)
                if (outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    codec.outputFormat.getByteBuffer("csd-0")?.let { csd ->
                        val bytes = ByteArray(csd.remaining())
                        csd.get(bytes)
                        head = OpusCsd.extractOpusHead(bytes)
                    }
                } else if (outIndex >= 0) {
                    if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0 && info.size > 0) {
                        val buf = codec.getOutputBuffer(outIndex)!!
                        val bytes = ByteArray(info.size)
                        buf.position(info.offset)
                        buf.get(bytes)
                        head = OpusCsd.extractOpusHead(bytes)
                    }
                    codec.releaseOutputBuffer(outIndex, false)
                }
            }
            return head
        }
    }
}
