package com.fable.wifisoundthing.protocol

import java.nio.ByteBuffer

/**
 * Wire-level constants and the UDP audio packet format.
 *
 * Audio packets travel host -> client over UDP. Header (16 bytes, network byte order):
 *
 * ```
 * offset 0  u16  magic "WT" (0x5754)
 * offset 2  u8   protocol version
 * offset 3  u8   codec id (0 = PCM 16-bit LE, 1 = Opus)
 * offset 4  u32  sequence number (wraps around)
 * offset 8  u64  capture timestamp, microseconds
 * offset 16 ...  payload (one encoded frame / PCM chunk)
 * ```
 */
object Wire {
    const val PROTOCOL_VERSION = 1
    const val MAGIC: Short = 0x5754 // "WT"

    const val CODEC_PCM16: Byte = 0
    const val CODEC_OPUS: Byte = 1

    const val HEADER_BYTES = 16

    /** Keep every datagram below a common 1500-byte MTU to avoid IP fragmentation. */
    const val MAX_PACKET_BYTES = 1400

    const val DEFAULT_CONTROL_PORT = 53705
    const val DISCOVERY_PORT = 53706

    const val SAMPLE_RATE = 48_000
    const val CHANNELS = 2
    const val BYTES_PER_SAMPLE = 2
    const val FRAME_MS = 20

    /** Bytes of PCM per UDP packet in PCM mode: 5 ms of 48 kHz stereo 16-bit. */
    const val PCM_CHUNK_BYTES = 960

    const val OPUS_BITRATE = 128_000

    fun codecName(codec: Byte): String = when (codec) {
        CODEC_PCM16 -> "pcm16"
        CODEC_OPUS -> "opus"
        else -> "unknown"
    }

    fun codecId(name: String): Byte? = when (name) {
        "pcm16" -> CODEC_PCM16
        "opus" -> CODEC_OPUS
        else -> null
    }

    /** Duration in microseconds represented by [bytes] of PCM at the stream format. */
    fun pcmBytesToUs(bytes: Int): Long =
        bytes.toLong() * 1_000_000L / (SAMPLE_RATE.toLong() * CHANNELS * BYTES_PER_SAMPLE)
}

class AudioPacket(
    val codec: Byte,
    val seq: Int,
    val ptsUs: Long,
    val payload: ByteArray,
) {
    fun toBytes(): ByteArray {
        val buf = ByteBuffer.allocate(Wire.HEADER_BYTES + payload.size)
        buf.putShort(Wire.MAGIC)
        buf.put(Wire.PROTOCOL_VERSION.toByte())
        buf.put(codec)
        buf.putInt(seq)
        buf.putLong(ptsUs)
        buf.put(payload)
        return buf.array()
    }

    companion object {
        fun parse(data: ByteArray, length: Int = data.size): AudioPacket? {
            if (length < Wire.HEADER_BYTES || length > data.size) return null
            val buf = ByteBuffer.wrap(data, 0, length)
            if (buf.short != Wire.MAGIC) return null
            if (buf.get() != Wire.PROTOCOL_VERSION.toByte()) return null
            val codec = buf.get()
            if (codec != Wire.CODEC_PCM16 && codec != Wire.CODEC_OPUS) return null
            val seq = buf.int
            val ptsUs = buf.long
            val payload = ByteArray(length - Wire.HEADER_BYTES)
            buf.get(payload)
            return AudioPacket(codec, seq, ptsUs, payload)
        }
    }
}
