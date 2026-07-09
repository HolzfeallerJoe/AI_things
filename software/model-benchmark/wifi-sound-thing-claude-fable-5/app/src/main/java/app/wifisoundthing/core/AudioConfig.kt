package app.wifisoundthing.core

/**
 * Describes the encoded audio stream. Sent from host to client in the WELCOME
 * handshake so the client can configure its decoder before the first packet.
 *
 * @param csd codec-specific data; for AAC-LC this is the 2-byte
 *            AudioSpecificConfig (fed to the decoder as "csd-0").
 */
class AudioConfig(
    val sampleRate: Int,
    val channelCount: Int,
    val codec: Int,
    val csd: ByteArray,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is AudioConfig) return false
        return sampleRate == other.sampleRate &&
            channelCount == other.channelCount &&
            codec == other.codec &&
            csd.contentEquals(other.csd)
    }

    override fun hashCode(): Int {
        var result = sampleRate
        result = 31 * result + channelCount
        result = 31 * result + codec
        result = 31 * result + csd.contentHashCode()
        return result
    }

    override fun toString(): String =
        "AudioConfig(rate=$sampleRate, ch=$channelCount, codec=$codec, csd=${csd.size}B)"
}

/**
 * Builds the MPEG-4 AudioSpecificConfig for AAC-LC analytically, so both sides
 * can derive it without waiting for the encoder to emit a config buffer.
 *
 * Layout (16 bits): 5 bits audioObjectType, 4 bits samplingFrequencyIndex,
 * 4 bits channelConfiguration, 3 bits padding (frameLength/depends/extension = 0).
 */
object AacCsd {
    private val FREQ_TABLE = intArrayOf(
        96000, 88200, 64000, 48000, 44100, 32000,
        24000, 22050, 16000, 12000, 11025, 8000, 7350,
    )

    fun frequencyIndex(sampleRate: Int): Int {
        val idx = FREQ_TABLE.indexOf(sampleRate)
        require(idx >= 0) { "Unsupported AAC sample rate: $sampleRate" }
        return idx
    }

    fun audioSpecificConfig(sampleRate: Int, channelCount: Int): ByteArray {
        require(channelCount in 1..7) { "Unsupported channel count: $channelCount" }
        val objectType = 2 // AAC-LC
        val freqIdx = frequencyIndex(sampleRate)
        val bits = (objectType shl 11) or (freqIdx shl 7) or (channelCount shl 3)
        return byteArrayOf(((bits shr 8) and 0xFF).toByte(), (bits and 0xFF).toByte())
    }
}
