package com.wifisoundthing.claudeopus46.audio

/**
 * Passthrough codec — raw 16-bit signed PCM.
 * Encode and decode are identity operations.
 */
class PcmCodec : AudioCodec {

    override val codecId: Byte = 0

    override val name: String = "PCM 16-bit"

    override fun encode(pcmData: ByteArray): ByteArray = pcmData

    override fun decode(encodedData: ByteArray): ByteArray = encodedData

    override fun release() { /* no-op */ }
}
