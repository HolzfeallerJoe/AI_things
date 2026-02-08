package com.wifisoundthing.claudeopus46.audio

/**
 * Codec abstraction for the audio pipeline.
 * PCM is the default passthrough; swap in OpusCodec later without touching
 * the streaming or playback code.
 */
interface AudioCodec {

    /** Numeric ID written into every packet header. 0 = PCM, 1 = Opus. */
    val codecId: Byte

    /** Human-readable name for logging and UI display. */
    val name: String

    /**
     * Encode a frame of raw PCM (16-bit signed LE, interleaved stereo).
     *
     * @param pcmData raw PCM bytes, length = frameSamples * channels * 2
     * @return encoded payload (for PCM this is the input unchanged)
     */
    fun encode(pcmData: ByteArray): ByteArray

    /**
     * Decode an encoded payload back to raw PCM.
     *
     * @param encodedData the payload extracted from a network packet
     * @return decoded PCM bytes
     */
    fun decode(encodedData: ByteArray): ByteArray

    /** Release native resources if any (e.g. Opus encoder state). */
    fun release()
}
