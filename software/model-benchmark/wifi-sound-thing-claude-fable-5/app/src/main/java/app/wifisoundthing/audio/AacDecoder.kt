package app.wifisoundthing.audio

import android.media.MediaCodec
import android.media.MediaFormat
import java.nio.ByteBuffer

/**
 * AAC-LC decoder wrapped around [MediaCodec] in synchronous mode.
 * Configured from the AudioSpecificConfig received in the WELCOME handshake.
 * Not thread-safe; drive it from the playback thread only.
 */
class AacDecoder(
    sampleRate: Int,
    channelCount: Int,
    csd: ByteArray,
) {
    private val codec: MediaCodec = MediaCodec.createDecoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)

    init {
        val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, sampleRate, channelCount).apply {
            setByteBuffer("csd-0", ByteBuffer.wrap(csd))
        }
        codec.configure(format, null, null, 0)
    }

    fun start() = codec.start()

    /**
     * Decodes one AAC frame; [onPcm] receives 16-bit PCM. A frame the codec
     * cannot accept within the timeout is dropped (better than stalling playback).
     */
    fun decode(frame: ByteArray, ptsUs: Long, onPcm: (pcm: ByteArray) -> Unit) {
        val inIndex = codec.dequeueInputBuffer(INPUT_TIMEOUT_US)
        if (inIndex >= 0) {
            val inBuf = codec.getInputBuffer(inIndex)!!
            inBuf.clear()
            inBuf.put(frame)
            codec.queueInputBuffer(inIndex, 0, frame.size, ptsUs, 0)
        }
        drain(onPcm)
    }

    private fun drain(onPcm: (ByteArray) -> Unit) {
        val info = MediaCodec.BufferInfo()
        while (true) {
            val outIndex = codec.dequeueOutputBuffer(info, 0)
            when {
                outIndex >= 0 -> {
                    if (info.size > 0) {
                        val outBuf = codec.getOutputBuffer(outIndex)!!
                        val pcm = ByteArray(info.size)
                        outBuf.position(info.offset)
                        outBuf.get(pcm)
                        onPcm(pcm)
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
    }
}
