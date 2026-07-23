package com.fable.wifisoundthing.audio

import android.media.MediaCodec
import android.media.MediaFormat
import android.util.Log
import com.fable.wifisoundthing.protocol.OpusCsd
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer

/**
 * Turns wire payloads back into playable PCM. [PcmDecoder] is a passthrough;
 * [OpusDecoder] wraps Android's MediaCodec Opus decoder (mandatory since Android 5, so
 * the client side is always available).
 */
interface AudioDecoder {
    /** Decodes one packet payload; may return an empty array (codec still priming). */
    fun decode(payload: ByteArray, ptsUs: Long): ByteArray

    fun release()
}

class PcmDecoder : AudioDecoder {
    override fun decode(payload: ByteArray, ptsUs: Long): ByteArray = payload
    override fun release() = Unit
}

class OpusDecoder private constructor(private val codec: MediaCodec) : AudioDecoder {

    override fun decode(payload: ByteArray, ptsUs: Long): ByteArray {
        try {
            val inIndex = codec.dequeueInputBuffer(10_000)
            if (inIndex >= 0) {
                val buf = codec.getInputBuffer(inIndex)!!
                buf.clear()
                buf.put(payload)
                codec.queueInputBuffer(inIndex, 0, payload.size, ptsUs, 0)
            }
            val info = MediaCodec.BufferInfo()
            var out: ByteArrayOutputStream? = null
            // First wait briefly for output (decode is fast, but give it a moment),
            // then sweep up anything else that is already available.
            var timeoutUs = 5_000L
            while (true) {
                val index = codec.dequeueOutputBuffer(info, timeoutUs)
                if (index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED ||
                    index == MediaCodec.INFO_OUTPUT_BUFFERS_CHANGED
                ) {
                    continue
                }
                if (index < 0) break
                if (info.size > 0) {
                    if (out == null) out = ByteArrayOutputStream(info.size)
                    val buf = codec.getOutputBuffer(index)!!
                    val bytes = ByteArray(info.size)
                    buf.position(info.offset)
                    buf.get(bytes)
                    out.write(bytes)
                }
                codec.releaseOutputBuffer(index, false)
                timeoutUs = 0L
            }
            return out?.toByteArray() ?: EMPTY
        } catch (e: Exception) {
            Log.w(TAG, "opus decode failed", e)
            return EMPTY
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
        private const val TAG = "OpusDecoder"
        private val EMPTY = ByteArray(0)

        fun create(opusHead: ByteArray, sampleRate: Int, channels: Int): OpusDecoder? {
            return try {
                val codec = MediaCodec.createDecoderByType(MediaFormat.MIMETYPE_AUDIO_OPUS)
                val format = MediaFormat.createAudioFormat(
                    MediaFormat.MIMETYPE_AUDIO_OPUS, sampleRate, channels
                )
                val csd = OpusCsd.decoderCsd(opusHead, sampleRate)
                format.setByteBuffer("csd-0", ByteBuffer.wrap(csd[0]))
                format.setByteBuffer("csd-1", ByteBuffer.wrap(csd[1]))
                format.setByteBuffer("csd-2", ByteBuffer.wrap(csd[2]))
                codec.configure(format, null, null, 0)
                codec.start()
                OpusDecoder(codec)
            } catch (e: Exception) {
                Log.e(TAG, "failed to create Opus decoder", e)
                null
            }
        }
    }
}
