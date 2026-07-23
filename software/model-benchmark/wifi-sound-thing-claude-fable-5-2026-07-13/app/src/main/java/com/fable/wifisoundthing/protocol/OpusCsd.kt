package com.fable.wifisoundthing.protocol

import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Helpers for the Opus "OpusHead" identification header and the codec-specific data
 * (csd-0/1/2) that Android's MediaCodec Opus decoder requires.
 *
 * Android's own Opus encoder (c2.android.opus.encoder) emits its config either as a bare
 * OpusHead or wrapped in the AOSP "AOPUS" block format:
 * `"AOPUSHDR" + u64le length + OpusHead [+ "AOPUSDLY" + u64le 8 + u64le delayNs]
 *  [+ "AOPUSPRL" + u64le 8 + u64le prerollNs]` — [extractOpusHead] handles both.
 */
object OpusCsd {
    const val OPUS_HEAD_MARKER = "OpusHead"
    private const val AOPUS_HDR_MARKER = "AOPUSHDR"
    const val DEFAULT_PRE_SKIP_SAMPLES = 3840 // 80 ms at 48 kHz, the libopus default
    const val DEFAULT_SEEK_PREROLL_NS = 80_000_000L

    /** Builds a minimal 19-byte OpusHead for mono/stereo, mapping family 0. */
    fun defaultOpusHead(
        channels: Int,
        sampleRate: Int,
        preSkipSamples: Int = DEFAULT_PRE_SKIP_SAMPLES,
    ): ByteArray {
        require(channels in 1..2) { "mapping family 0 supports 1-2 channels" }
        val buf = ByteBuffer.allocate(19).order(ByteOrder.LITTLE_ENDIAN)
        buf.put(OPUS_HEAD_MARKER.toByteArray(Charsets.US_ASCII))
        buf.put(1) // header version
        buf.put(channels.toByte())
        buf.putShort(preSkipSamples.toShort())
        buf.putInt(sampleRate)
        buf.putShort(0) // output gain
        buf.put(0) // channel mapping family 0
        return buf.array()
    }

    /**
     * Extracts a bare OpusHead from encoder csd-0 output, whether it is already bare or
     * wrapped in the AOSP AOPUS block structure. Returns null if neither is recognized.
     */
    fun extractOpusHead(csd0: ByteArray): ByteArray? {
        if (startsWith(csd0, OPUS_HEAD_MARKER)) return csd0.copyOf()
        if (!startsWith(csd0, AOPUS_HDR_MARKER)) return null
        // Walk "marker(8) + u64le length + payload" blocks; the AOPUSHDR payload is the head.
        var pos = 0
        while (pos + 16 <= csd0.size) {
            val marker = String(csd0, pos, 8, Charsets.US_ASCII)
            val len = ByteBuffer.wrap(csd0, pos + 8, 8).order(ByteOrder.LITTLE_ENDIAN).long
            if (len < 0 || pos + 16 + len > csd0.size) return null
            if (marker == AOPUS_HDR_MARKER) {
                val head = csd0.copyOfRange(pos + 16, pos + 16 + len.toInt())
                return if (startsWith(head, OPUS_HEAD_MARKER)) head else null
            }
            pos += 16 + len.toInt()
        }
        return null
    }

    /** Reads the pre-skip sample count from an OpusHead (u16le at offset 10). */
    fun preSkipSamples(opusHead: ByteArray): Int {
        if (opusHead.size < 12 || !startsWith(opusHead, OPUS_HEAD_MARKER)) {
            return DEFAULT_PRE_SKIP_SAMPLES
        }
        return ByteBuffer.wrap(opusHead, 10, 2).order(ByteOrder.LITTLE_ENDIAN).short.toInt() and 0xFFFF
    }

    /**
     * The three codec-specific-data buffers MediaCodec's Opus decoder expects:
     * csd-0 = OpusHead, csd-1 = u64le pre-skip in ns, csd-2 = u64le seek pre-roll in ns.
     */
    fun decoderCsd(opusHead: ByteArray, sampleRate: Int): Array<ByteArray> {
        val preSkipNs = preSkipSamples(opusHead).toLong() * 1_000_000_000L / sampleRate
        return arrayOf(opusHead, u64le(preSkipNs), u64le(DEFAULT_SEEK_PREROLL_NS))
    }

    private fun u64le(value: Long): ByteArray =
        ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN).putLong(value).array()

    private fun startsWith(data: ByteArray, marker: String): Boolean {
        if (data.size < marker.length) return false
        for (i in marker.indices) {
            if (data[i] != marker[i].code.toByte()) return false
        }
        return true
    }
}
